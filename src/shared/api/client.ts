import {
  blockUnverifiedAuth, captureAuth, clearStoredAuth, ensureAuthLockAccess, hasConfirmedAuthLock, isCurrentAuth,
  isResetAuthBlocked, isToken, updateApiAccessToken, type AuthSnapshot,
} from "./auth";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export interface ApiRequestOptions<T = unknown> extends Omit<RequestInit, "body"> {
  /** Public request: omit stored credentials and do not expire the session on 401. */
  skipAuth?: boolean;
  /** Bind the request to credentials captured after verifying the session owner. */
  authSnapshot?: AuthSnapshot;
  body?: unknown;
  responseBody?: "text";
  decode?: (data: unknown, status: number) => T;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly data: unknown,
    public readonly kind: "http" | "network" | "response" = "http",
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function resolveUrl(path: string) {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  const baseUrl = API_BASE_URL.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

const refreshes = new Map<string, Promise<boolean>>();

function refreshAccess(snapshot: AuthSnapshot): Promise<boolean> {
  const session = snapshot.session;
  if (!session) return Promise.resolve(false);
  const current = captureAuth();
  if (current.storage.status === "unavailable") {
    blockUnverifiedAuth(snapshot);
    return Promise.resolve(false);
  }
  if (!isCurrentAuth(snapshot, current)) return Promise.resolve(false);
  if (current.accessToken !== snapshot.accessToken) return Promise.resolve(true);
  const existing = refreshes.get(session.id);
  if (existing) return existing;
  const pending = request("/reissue", {
    method: "POST", skipAuth: true, redirect: "error",
    headers: { Authorization: `Bearer ${session.refreshToken}` },
    decode(data, status) {
      if (status !== 200 || !data || typeof data !== "object" ||
        !("accessToken" in data) || !isToken(data.accessToken)) throw new Error("Invalid refresh response");
      return data.accessToken;
    },
  }).then((accessToken) => updateApiAccessToken(snapshot, accessToken))
    .catch(async () => {
      await clearStoredAuth(snapshot, { redirect: true, requireSameAccessToken: true });
      return isCurrentAuth(snapshot) && captureAuth().accessToken !== snapshot.accessToken;
    })
    .finally(() => refreshes.delete(session.id));
  refreshes.set(session.id, pending);
  return pending;
}

function waitForAuth(pending: Promise<boolean>, signal: AbortSignal | null | undefined) {
  if (!signal) return pending;
  signal.throwIfAborted();
  return new Promise<boolean>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    void pending.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

function serializeBody(body: unknown) {
  if (
    body === undefined ||
    body === null ||
    typeof body === "string" ||
    (typeof FormData !== "undefined" && body instanceof FormData) ||
    (typeof Blob !== "undefined" && body instanceof Blob) ||
    (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) ||
    (typeof ArrayBuffer !== "undefined" && body instanceof ArrayBuffer)
  ) {
    return body as BodyInit | null | undefined;
  }

  return JSON.stringify(body);
}

function isFormData(body: unknown): body is FormData {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

async function parseResponse(response: Response, responseBody?: "text"): Promise<unknown> {
  if (response.status === 204) {
    return null;
  }

  if (response.ok && responseBody === "text") return response.text();

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

async function request<T = unknown>(path: string, options: ApiRequestOptions<T> = {}, retried = false): Promise<T> {
  const { skipAuth = false, authSnapshot, body, responseBody, decode, ...requestOptions } = options;
  const headers = new Headers(requestOptions.headers);

  if (body !== undefined && !isFormData(body) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  requestOptions.signal?.throwIfAborted();
  const snapshot = skipAuth ? null : authSnapshot ?? captureAuth();
  if (snapshot) {
    const canUseAuthLock = hasConfirmedAuthLock() ||
      await waitForAuth(ensureAuthLockAccess(), requestOptions.signal);
    requestOptions.signal?.throwIfAborted();
    if (!canUseAuthLock || snapshot.storage.status === "unavailable") {
      throw new ApiError("로그인 상태를 확인할 수 없습니다.", 401, null);
    }
    if (!isCurrentAuth(snapshot)) {
      throw new ApiError("로그인 계정이 변경되었습니다.", 401, null);
    }
  }
  if (snapshot?.accessToken) headers.set("Authorization", `Bearer ${snapshot.accessToken}`);

  const url = resolveUrl(path);
  const init = {
    ...requestOptions,
    body: serializeBody(body),
    headers,
  };
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    if (requestOptions.signal?.aborted) throw error;
    // Browsers do not distinguish a CORS rejection from other network failures.
    throw new ApiError("서버에 연결할 수 없습니다. 네트워크 연결 및 서버 설정을 확인해 주세요.", 0, null, "network");
  }
  let data: unknown;
  try {
    data = await parseResponse(response, responseBody);
  } catch (error) {
    if (requestOptions.signal?.aborted) throw error;
    // Malformed error bodies must not hide HTTP status or bypass 401 handling.
    if (response.ok) {
      throw new ApiError("API 응답 형식이 올바르지 않습니다.", response.status, null, "response");
    }
    data = null;
  }

  requestOptions.signal?.throwIfAborted();
  if (response.status === 401 && snapshot) {
    if (isResetAuthBlocked(snapshot)) throw new ApiError("인증이 만료되었습니다.", response.status, data);
    if (!retried && snapshot.session &&
      !/^\/(?:login|reissue|logout)\/?$/.test(new URL(url, "http://localhost").pathname)) {
      const renewed = await waitForAuth(refreshAccess(snapshot), requestOptions.signal);
      const method = (options.method ?? "GET").toUpperCase();
      // Only reads are automatically replayed. Paid or destructive requests are never repeated.
      if (renewed && (method === "GET" || method === "HEAD")) {
        const renewedAuth = captureAuth();
        if (renewedAuth.revision === snapshot.revision && renewedAuth.session?.id === snapshot.session.id) {
          return request(path, { ...options, authSnapshot: renewedAuth }, true);
        }
      }
    } else if (snapshot.storage.status === "readable") {
      // Ownership and the rejected token must be checked while holding the storage lock.
      await clearStoredAuth(snapshot, { redirect: true, requireSameAccessToken: true });
    }
    throw new ApiError("인증이 만료되었습니다.", response.status, data);
  }

  if (!response.ok) {
    throw new ApiError("API 요청에 실패했습니다.", response.status, data);
  }

  if (decode) {
    try {
      return decode(data, response.status);
    } catch {
      throw new ApiError("API 응답 형식이 올바르지 않습니다.", response.status, null, "response");
    }
  }

  // Generic types alone do not validate JSON. Contract-aware callers use decode
  // or request unknown and validate in their existing domain adapter.
  return data as T;
}

export const apiClient = {
  request,
  get<T = unknown>(path: string, options?: Omit<ApiRequestOptions<T>, "body" | "method">) {
    return request<T>(path, { ...options, method: "GET" });
  },
  post<T = unknown>(path: string, body?: unknown, options?: Omit<ApiRequestOptions<T>, "body" | "method">) {
    return request<T>(path, { ...options, body, method: "POST" });
  },
  put<T = unknown>(path: string, body?: unknown, options?: Omit<ApiRequestOptions<T>, "body" | "method">) {
    return request<T>(path, { ...options, body, method: "PUT" });
  },
  patch<T = unknown>(path: string, body?: unknown, options?: Omit<ApiRequestOptions<T>, "body" | "method">) {
    return request<T>(path, { ...options, body, method: "PATCH" });
  },
  delete<T = unknown>(path: string, options?: Omit<ApiRequestOptions<T>, "body" | "method">) {
    return request<T>(path, { ...options, method: "DELETE" });
  },
};
