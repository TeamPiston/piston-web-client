import { apiClient } from "@/shared/api";
import { ensureAuthLockAccess, isToken, type ApiTokens, type AuthSnapshot } from "@/shared/api/auth";
import type { UserProfile } from "./context";

export interface LoginCredentials {
  id: string;
  password: string;
}

function decodeProfile(value: unknown, status: number): UserProfile {
  if (status !== 200 || !value || typeof value !== "object" ||
    !("userId" in value) || !(isToken(value.userId) ||
      (typeof value.userId === "number" && Number.isSafeInteger(value.userId) && value.userId > 0)) ||
    !("loginId" in value) || !isToken(value.loginId) ||
    !("email" in value) || !isToken(value.email) ||
    !("createdAt" in value) || typeof value.createdAt !== "string" ||
    !Number.isFinite(Date.parse(value.createdAt))) throw new Error("Invalid user profile");
  return { id: value.loginId, name: value.loginId, userId: String(value.userId), email: value.email, createdAt: value.createdAt };
}

export async function authenticate(credentials: LoginCredentials, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const canUseAuthLock = await ensureAuthLockAccess();
  signal?.throwIfAborted();
  if (!canUseAuthLock) throw new Error("로그인 저장소를 동기화할 수 없습니다.");
  const tokens = await apiClient.post<ApiTokens>("/login", credentials, {
    skipAuth: true, signal, redirect: "error",
    decode(value, status) {
      if (status !== 200 || !value || typeof value !== "object" ||
        !("accessToken" in value) || !isToken(value.accessToken) ||
        !("refreshToken" in value) || !isToken(value.refreshToken)) throw new Error("Invalid login response");
      return { accessToken: value.accessToken, refreshToken: value.refreshToken };
    },
  });
  const user = await apiClient.get("/api/users/me", {
    skipAuth: true, signal, redirect: "error",
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
    decode: decodeProfile,
  }).catch((error: unknown) => {
    // Authentication failure here belongs to profile verification, not the credential form.
    signal?.throwIfAborted();
    throw new Error("로그인 후 사용자 정보를 확인할 수 없습니다.", { cause: error });
  });
  return { tokens, user };
}

const restorations = new Map<string, Promise<UserProfile>>();

export function restoreApiProfile(snapshot: AuthSnapshot) {
  const key = JSON.stringify([snapshot.session?.id, snapshot.revision]);
  const active = restorations.get(key);
  if (active) return active;
  const pending = apiClient.get("/api/users/me", {
    authSnapshot: snapshot, redirect: "error", decode: decodeProfile,
  }).finally(() => restorations.delete(key));
  restorations.set(key, pending);
  return pending;
}

export async function revokeApiSession(refreshToken: string) {
  if (!await ensureAuthLockAccess()) return;
  return apiClient.post("/logout", undefined, {
    skipAuth: true, redirect: "error",
    headers: { Authorization: `Bearer ${refreshToken}` },
    decode: requireNoContent,
  });
}

export function requireNoContent(_value: unknown, status: number) {
  if (status !== 204) throw new Error("Expected empty response");
}
