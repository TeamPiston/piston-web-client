import { apiClient } from "@/shared/api";
import type { AuthSnapshot } from "@/shared/api/auth";
import {
  cancelMockPrint,
  createMockPrintTask,
  fetchMockPrintStatus,
  isMockModeEnabled,
  retryMockPrint,
  withMockFallback,
} from "@/shared/mock/mock-data";

export const PRINT_USER_ID = "demo-user";
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

function optionalString(...values: unknown[]) {
  return values.find((value): value is string => typeof value === "string");
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

  if (typeof candidate.id !== "number" && typeof candidate.id !== "string") {
    return null;
  }

  const id = Number(candidate.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
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

  const progress = Math.min(100, Math.max(0, Number(candidate.progress ?? 0)));

  return {
    id,
    userId: String(candidate.userId ?? PRINT_USER_ID),
    artworkName: optionalString(candidate.artworkName)?.trim() || "디자인 이름 확인 불가",
    modelUrl: optionalString(candidate.modelUrl ?? candidate.stlUrl),
    printerName: optionalString(candidate.printerName),
    printingMethod: optionalString(candidate.printingMethod),
    filamentRemaining: optionalString(candidate.filamentRemaining),
    failureReason: optionalString(
      candidate.failureReason,
      candidate.failureMessage,
      candidate.errorReason,
      candidate.errorMessage,
      candidate.stopReason,
    ),
    stoppedAt: optionalString(
      candidate.stoppedAt,
      candidate.failedAt,
      candidate.failureAt,
      candidate.endedAt,
      candidate.updatedAt,
    ),
    status,
    progress: Number.isNaN(progress) ? 0 : progress,
    remainingMinutes: Number(candidate.remainingMinutes ?? 0),
    estimatedEndTime: String(candidate.estimatedEndTime ?? ""),
    createdAt: String(candidate.createdAt ?? ""),
  };
}

export async function createPrintTask(artworkName = PRINT_ARTWORK_NAME) {
  requireMockPrintActions();
  return createMockPrintTask(artworkName);
}

export async function getCurrentPrintTask(signal?: AbortSignal, authSnapshot?: AuthSnapshot) {
  return withMockFallback(
    async () => {
      const response = await apiClient.get<unknown>("/api/prints/current", { signal, authSnapshot });
      if (unwrapResponse(response) === null) {
        return null;
      }

      const task = normalizePrintTask(response);
      if (!task) {
        throw new Error("출력 상태 응답 형식이 올바르지 않습니다.");
      }
      return task;
    },
    fetchMockPrintStatus,
  );
}

export async function cancelPrintTask(printTaskId: number) {
  requireMockPrintActions();
  await cancelMockPrint(printTaskId);
}

export async function retryPrintTask(printTask: PrintTask) {
  requireMockPrintActions();
  return retryMockPrint(printTask.id);
}

function requireMockPrintActions() {
  if (!isMockModeEnabled()) {
    throw new Error("출력 기능 준비 중");
  }
}
