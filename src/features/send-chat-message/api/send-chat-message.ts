import { ChatInputError } from "@/entities/chat";
import { apiClient } from "@/shared/api";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export interface SendChatMessageInput {
  message: string;
  image?: File;
}

export interface SentChatMessage {
  chatId: string;
  jobId: null;
  reply: string;
}

function decodeSentChatMessage(value: unknown): SentChatMessage {
  if (
    typeof value !== "object" || value === null ||
    !("chatId" in value) || typeof value.chatId !== "string" ||
    !("jobId" in value) || value.jobId !== null ||
    !("reply" in value) || typeof value.reply !== "string"
  ) {
    throw new Error("Invalid chat reply");
  }

  return { chatId: value.chatId, jobId: value.jobId, reply: value.reply };
}

/** Sends one explicit, potentially billable request. Aborting only stops the client from waiting. */
export async function sendChatMessage(
  { message, image }: SendChatMessageInput,
  { signal }: { signal?: AbortSignal } = {},
): Promise<SentChatMessage> {
  signal?.throwIfAborted();

  if (typeof message !== "string" || message.trim() === "") {
    throw new ChatInputError("message", "채팅 메시지를 입력해 주세요.");
  }

  const body = new FormData();
  body.set("message", message);
  if (image !== undefined) {
    if (typeof File === "undefined" || !(image instanceof File) || !IMAGE_TYPES.has(image.type)) {
      throw new ChatInputError("image", "JPEG, PNG 또는 WebP 이미지 파일만 보낼 수 있습니다.");
    }
    if (image.size > MAX_IMAGE_BYTES) {
      throw new ChatInputError("image", "이미지는 최대 10MB까지 보낼 수 있습니다.");
    }
    body.set("image", image);
  }

  // A 307 or 308 could otherwise cause fetch to send the billable POST again.
  return apiClient.post("/chats/messages", body, { signal, redirect: "error", decode: decodeSentChatMessage });
}
