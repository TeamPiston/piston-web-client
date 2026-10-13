import { apiClient } from "@/shared/api";
import { deleteMockAccount, withMockFallback } from "@/shared/mock/mock-data";

export async function deleteCurrentAccount() {
  await withMockFallback(
    () => apiClient.delete<void>("/api/users/me"),
    deleteMockAccount,
  );
}
