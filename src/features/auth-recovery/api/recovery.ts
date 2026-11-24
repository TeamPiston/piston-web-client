import { apiClient } from "@/shared/api";

function requireNoContent(_body: unknown, status: number): void {
  if (status !== 204) throw new Error("Unexpected account recovery response");
}

const options = { skipAuth: true, redirect: "error", decode: requireNoContent } as const;

export function findId(email: string, signal: AbortSignal): Promise<void> {
  return apiClient.post("/find-id", { email }, { ...options, signal });
}

export function findPassword(email: string, signal: AbortSignal): Promise<void> {
  return apiClient.post("/find-password", { email }, { ...options, signal });
}

export function resetPassword(token: string, newPassword: string, signal: AbortSignal): Promise<void> {
  return apiClient.post("/reset-password", { token, newPassword }, { ...options, signal });
}
