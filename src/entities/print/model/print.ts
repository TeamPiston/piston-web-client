import { apiClient } from "@/shared/api";

export const PRINT_USER_ID = "dlskawls";
export const PRINT_ARTWORK_NAME = "육각형 연필꽂이";

export type PrintStatus =
  | "PRINTING"
  | "COMPLETED"
  | "FAILED"
  | "ERROR"
  | "CANCELLED"
  | "CANCELED"
  | "EMPTY";

export interface PrintTask {
  id: number;
  userId: string;
  artworkName: string;
  modelUrl?: string;
  printerName?: string;
  printingMethod?: string;
  filamentRemaining?: string;
  failureReason?: string;
  stoppedAt?: string;
  status: PrintStatus;
  progress: number;
  remainingMinutes: number;
  estimatedEndTime: string;
  createdAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
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
  if (
    status !== "PRINTING" &&
    status !== "COMPLETED" &&
    status !== "FAILED" &&
    status !== "ERROR" &&
    status !== "CANCELLED" &&
    status !== "CANCELED" &&
    status !== "EMPTY"
  ) {
    return null;
  }

  return {
    id: Number(candidate.id ?? 0),
    userId: String(candidate.userId ?? PRINT_USER_ID),
    artworkName: String(candidate.artworkName ?? PRINT_ARTWORK_NAME),
    modelUrl: optionalString(candidate.modelUrl ?? candidate.stlUrl),
    printerName: optionalString(candidate.printerName),
    printingMethod: optionalString(candidate.printingMethod),
    filamentRemaining: optionalString(candidate.filamentRemaining),
    failureReason: optionalString(
      candidate.failureReason ??
        candidate.failureMessage ??
        candidate.errorReason ??
        candidate.errorMessage ??
        candidate.stopReason,
    ),
    stoppedAt: optionalString(
      candidate.stoppedAt ??
        candidate.failedAt ??
        candidate.failureAt ??
        candidate.endedAt ??
        candidate.updatedAt,
    ),
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

export async function cancelPrintTask(printTaskId: number) {
  await apiClient.delete<void>(`/api/prints/${printTaskId}`);
}
