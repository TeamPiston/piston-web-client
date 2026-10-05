import { apiClient } from "@/shared/api";

export async function deleteCurrentAccount() {
  await apiClient.delete<void>("/api/users/me");
}
