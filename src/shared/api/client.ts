import {
  ACCESS_TOKEN_STORAGE_KEY,
  AUTH_EXPIRED_EVENT,
  SESSION_STORAGE_KEY,
} from "./auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export interface ApiRequestOptions<T = unknown> extends Omit<RequestInit, "body"> {
  /** Public request: omit stored credentials and do not expire the session on 401. */
  skipAuth?: boolean;
  body?: unknown;
  decode?: (data: unknown) => T;
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

function getAccessToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
}

function clearStoredAuth() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
  window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));

  if (window.location.pathname !== "/login") {
    // Expired sessions require a full reload; this transport cannot use Router hooks.
    window.location.assign(window.location.origin + "/login");
  }
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

async function parseResponse(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

async function request<T = unknown>(path: string, options: ApiRequestOptions<T> = {}) {
  const { skipAuth = false, body, decode, ...requestOptions } = options;
  const headers = new Headers(requestOptions.headers);

  if (body !== undefined && !isFormData(body) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (!skipAuth) {
    const accessToken = getAccessToken();
    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }
  }

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
    data = await parseResponse(response);
  } catch (error) {
    if (requestOptions.signal?.aborted) throw error;
    // Malformed error bodies must not hide HTTP status or bypass 401 handling.
    if (response.ok) {
      throw new ApiError("API 응답 형식이 올바르지 않습니다.", response.status, null, "response");
    }
    data = null;
  }

  if (response.status === 401 && !skipAuth) {
    clearStoredAuth();
    throw new ApiError("인증이 만료되었습니다.", response.status, data);
  }

  if (!response.ok) {
    throw new ApiError("API 요청에 실패했습니다.", response.status, data);
  }

  if (decode) {
    try {
      return decode(data);
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
