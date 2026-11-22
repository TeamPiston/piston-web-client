import { ApiError, apiClient } from "@/shared/api";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export interface TextTo3DInput {
  prompt: string;
}

export interface ImageTo3DInput {
  image: File;
}

export interface MeshyTaskAccepted {
  taskId: string;
}

export type MeshyTaskStatus = MeshyTaskAccepted & (
  | { status: "PENDING" }
  | { status: "SUCCEEDED"; modelUrl: string }
  | { status: "FAILED"; failureReason?: string }
);

export class ModelGenerationInputError extends Error {
  constructor(
    public readonly field: "prompt" | "image" | "taskId",
    message: string,
  ) {
    super(message);
    this.name = "ModelGenerationInputError";
  }
}

export class MeshyTaskConflictError extends ApiError {
  constructor(error: ApiError, public readonly taskId: string | null) {
    super(error.message, error.status, error.data, error.kind);
    this.name = "MeshyTaskConflictError";
  }
}

interface GenerationOptions {
  signal?: AbortSignal;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isTaskId(value: unknown): value is string {
  // Dot segments change the route, and lone surrogate code units cannot be URL-encoded.
  return isNonBlankString(value) && value !== "." && value !== ".." && !/[\uD800-\uDFFF]/u.test(value);
}

function isModelUrl(value: string): boolean {
  // Allow HTTP(S) storage URLs and same-origin root-relative paths.
  if (/[\s\\]/.test(value)) return false;
  if (value.startsWith("/")) return !value.startsWith("//");
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    const url = new URL(value);
    return url.username === "" && url.password === "";
  } catch {
    return false;
  }
}

function decodeAcceptedTask(value: unknown, status: number): MeshyTaskAccepted {
  if (status !== 202 || !isRecord(value) || !isTaskId(value.taskId)) {
    throw new Error("Invalid Meshy task acceptance");
  }
  return { taskId: value.taskId };
}

function decodeTaskStatus(value: unknown, expectedTaskId: string): MeshyTaskStatus {
  if (!isRecord(value) || value.taskId !== expectedTaskId) {
    throw new Error("Invalid Meshy task ID in response");
  }
  const { status, modelUrl, failureReason } = value;
  if (
    (modelUrl !== undefined && !isNonBlankString(modelUrl)) ||
    (failureReason !== undefined && !isNonBlankString(failureReason))
  ) {
    throw new Error("Invalid Meshy task result");
  }

  switch (status) {
    case "PENDING":
      return { taskId: expectedTaskId, status };
    case "SUCCEEDED":
      if (modelUrl === undefined || !isModelUrl(modelUrl)) {
        throw new Error("Invalid Meshy model URL");
      }
      return { taskId: expectedTaskId, status, modelUrl };
    case "FAILED":
      return failureReason === undefined
        ? { taskId: expectedTaskId, status }
        : { taskId: expectedTaskId, status, failureReason };
    default:
      throw new Error("Unknown Meshy task status");
  }
}

async function requestModel(
  path: "/meshy/text-to-3d" | "/meshy/image-to-3d",
  body: TextTo3DInput | FormData,
  signal: AbortSignal | undefined,
): Promise<MeshyTaskAccepted> {
  try {
    // Fetch must not replay a potentially billable POST on a 307 or 308 redirect.
    return await apiClient.post(path, body, { signal, redirect: "error", decode: decodeAcceptedTask });
  } catch (error) {
    signal?.throwIfAborted();
    if (error instanceof ApiError && error.status === 409 && isRecord(error.data)) {
      const { taskId } = error.data;
      if (taskId === null || isTaskId(taskId)) {
        throw new MeshyTaskConflictError(error, taskId);
      }
    }
    throw error;
  }
}

/** Aborting the local request does not guarantee cancellation of server work. */
export async function generateTextTo3D(
  { prompt }: TextTo3DInput,
  { signal }: GenerationOptions = {},
): Promise<MeshyTaskAccepted> {
  signal?.throwIfAborted();
  if (typeof prompt !== "string" || prompt.trim() === "") {
    throw new ModelGenerationInputError("prompt", "3D 모델 생성 프롬프트를 입력해 주세요.");
  }

  return requestModel("/meshy/text-to-3d", { prompt }, signal);
}

/** Aborting the local request does not guarantee cancellation of server work. */
export async function generateImageTo3D(
  { image }: ImageTo3DInput,
  { signal }: GenerationOptions = {},
): Promise<MeshyTaskAccepted> {
  signal?.throwIfAborted();
  if (typeof File === "undefined" || !(image instanceof File) || !IMAGE_TYPES.has(image.type)) {
    throw new ModelGenerationInputError("image", "JPEG, PNG 또는 WebP 이미지 파일만 보낼 수 있습니다.");
  }
  if (image.size > MAX_IMAGE_BYTES) {
    throw new ModelGenerationInputError("image", "이미지는 최대 10 MiB까지 보낼 수 있습니다.");
  }

  const body = new FormData();
  body.set("image", image);
  return requestModel("/meshy/image-to-3d", body, signal);
}

/** Reads the task once. The caller controls when to check again. */
export async function getMeshyTaskStatus(
  taskId: string,
  { signal }: GenerationOptions = {},
): Promise<MeshyTaskStatus> {
  signal?.throwIfAborted();
  if (!isTaskId(taskId)) {
    throw new ModelGenerationInputError("taskId", "유효한 3D 생성 작업 ID가 필요합니다.");
  }

  try {
    return await apiClient.get("/meshy/tasks/" + encodeURIComponent(taskId), {
      signal,
      cache: "no-store",
      decode: (value) => decodeTaskStatus(value, taskId),
    });
  } catch (error) {
    signal?.throwIfAborted();
    throw error;
  }
}
