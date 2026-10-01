import { apiClient } from "@/shared/api";

export const PRINT_USER_ID = "dlskawls";
export const PRINT_ARTWORK_NAME = "육각형 연필꽂이";

export type PrintStatus = "PRINTING" | "COMPLETED" | "EMPTY";

export interface PrintTask {
  id: number;
  userId: string;
  artworkName: string;
  status: PrintStatus;
  progress: number;
  remainingMinutes: number;
  estimatedEndTime: string;
  createdAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function unwrapResponse(value: unknown) {
  if (!isRecord(value) || !("data" in value)) {
    return value;
  }

  return value.data;
}

function normalizePrintTask(value: unknown): PrintTask | null {
  const candidate = unwrapResponse(value);

  if (!isRecord(candidate)) {
    return null;
  }

  const status = candidate.status;
  if (status !== "PRINTING" && status !== "COMPLETED" && status !== "EMPTY") {
    return null;
  }

  return {
    id: Number(candidate.id ?? 0),
    userId: String(candidate.userId ?? PRINT_USER_ID),
    artworkName: String(candidate.artworkName ?? PRINT_ARTWORK_NAME),
    status,
    progress: Number(candidate.progress ?? 0),
    remainingMinutes: Number(candidate.remainingMinutes ?? 0),
    estimatedEndTime: String(candidate.estimatedEndTime ?? ""),
    createdAt: String(candidate.createdAt ?? ""),
  };
}

export async function createPrintTask(artworkName = PRINT_ARTWORK_NAME) {
  const response = await apiClient.post<unknown>("/api/prints", {
    userId: PRINT_USER_ID,
    artworkName,
  });
  const printTask = normalizePrintTask(response);

  if (!printTask) {
    throw new Error("출력 시작 응답 형식이 올바르지 않습니다.");
  }

  return printTask;
}

export async function getCurrentPrintTask() {
  const response = await apiClient.get<unknown>("/api/prints/current");

  if (response === null) {
    return null;
  }

  return normalizePrintTask(response);
}
