import {
  ACCESS_TOKEN_STORAGE_KEY,
  AUTH_EXPIRED_EVENT,
  SESSION_STORAGE_KEY,
} from "./auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  skipAuth?: boolean;
  body?: unknown;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly data: unknown,
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
    window.location.assign("/login");
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

async function parseResponse(response: Response) {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

async function request<T>(path: string, options: ApiRequestOptions = {}) {
  const { skipAuth = false, body, ...requestOptions } = options;
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

  const response = await fetch(resolveUrl(path), {
    ...requestOptions,
    body: serializeBody(body),
    headers,
  });
  const data = await parseResponse(response);

  if (response.status === 401) {
    clearStoredAuth();
    throw new ApiError("인증이 만료되었습니다.", response.status, data);
  }

  if (!response.ok) {
    throw new ApiError("API 요청에 실패했습니다.", response.status, data);
  }

  return data as T;
}

export const apiClient = {
  request,
  get<T>(path: string, options?: Omit<ApiRequestOptions, "body" | "method">) {
    return request<T>(path, { ...options, method: "GET" });
  },
  post<T>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, "body" | "method">) {
    return request<T>(path, { ...options, body, method: "POST" });
  },
  put<T>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, "body" | "method">) {
    return request<T>(path, { ...options, body, method: "PUT" });
  },
  patch<T>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, "body" | "method">) {
    return request<T>(path, { ...options, body, method: "PATCH" });
  },
  delete<T>(path: string, options?: Omit<ApiRequestOptions, "body" | "method">) {
    return request<T>(path, { ...options, method: "DELETE" });
  },
};
