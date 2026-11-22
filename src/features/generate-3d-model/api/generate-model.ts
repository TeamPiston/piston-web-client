import { apiClient } from "@/shared/api";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export interface TextTo3DInput {
  prompt: string;
}

export interface ImageTo3DInput {
  image: File;
}

export interface GeneratedModel {
  modelUrl: string;
}

export class ModelGenerationInputError extends Error {
  constructor(
    public readonly field: "prompt" | "image",
    message: string,
  ) {
    super(message);
    this.name = "ModelGenerationInputError";
  }
}

interface GenerationOptions {
  signal?: AbortSignal;
}

function decodeGeneratedModel(value: unknown): GeneratedModel {
  if (
    typeof value !== "object" || value === null || Array.isArray(value) ||
    !("modelUrl" in value) || typeof value.modelUrl !== "string" || value.modelUrl.trim() === ""
  ) {
    throw new Error("Invalid generated model response");
  }

  return { modelUrl: value.modelUrl };
}

function requestModel(
  path: "/meshy/text-to-3d" | "/meshy/image-to-3d",
  body: TextTo3DInput | FormData,
  signal: AbortSignal | undefined,
): Promise<GeneratedModel> {
  // Fetch must not replay a potentially billable POST on a 307 or 308 redirect.
  return apiClient.post(path, body, { signal, redirect: "error", decode: decodeGeneratedModel });
}

/** Aborting the local request does not guarantee cancellation of server work. */
export async function generateTextTo3D(
  { prompt }: TextTo3DInput,
  { signal }: GenerationOptions = {},
): Promise<GeneratedModel> {
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
): Promise<GeneratedModel> {
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
