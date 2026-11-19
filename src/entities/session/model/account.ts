import { deleteMockAccount, isMockModeEnabled } from "@/shared/mock/mock-data";

export class AccountDeletionUnavailableError extends Error {
  constructor() {
    super("실제 서버 회원 탈퇴는 아직 지원하지 않습니다. 서비스 연동을 준비 중입니다.");
    this.name = "AccountDeletionUnavailableError";
  }
}

export async function deleteCurrentAccount() {
  if (!isMockModeEnabled()) {
    throw new AccountDeletionUnavailableError();
  }

  await deleteMockAccount();
}
