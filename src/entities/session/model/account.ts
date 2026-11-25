import { apiClient } from "@/shared/api";
import { captureAuth, clearStoredAuth, isCurrentAuth } from "@/shared/api/auth";
import { deleteMockAccount, isMockModeEnabled } from "@/shared/mock/mock-data";
import { requireNoContent } from "./api-session";

export class AccountDeletionSessionChangedError extends Error {
  constructor() {
    super("로그인 계정이 변경되었습니다. 다시 로그인 상태를 확인해 주세요.");
  }
}

export async function deleteCurrentAccount(expectedSessionId?: string) {
  if (isMockModeEnabled()) {
    await deleteMockAccount();
    return true;
  }

  const snapshot = captureAuth();
  if (!snapshot.session || snapshot.session.id !== expectedSessionId) {
    throw new AccountDeletionSessionChangedError();
  }
  try {
    await apiClient.delete("/api/users/me", {
      authSnapshot: snapshot,
      redirect: "error",
      decode: requireNoContent,
    });
  } catch (error) {
    if (!isCurrentAuth(snapshot)) throw new AccountDeletionSessionChangedError();
    throw error;
  }
  return clearStoredAuth(snapshot);
}
