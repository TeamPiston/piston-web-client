import { apiClient } from "@/shared/api";
import { ChatInputError } from "../model/chat-input-error";
import type { ChatHistoryMessage, ChatHistoryOptions, ChatHistoryPage } from "../model/types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value) || !Number.isFinite(Date.parse(value))) {
    return false;
  }
  // Date.parse can normalize an impossible calendar date, such as February 30.
  const date = value.slice(0, 10);
  return new Date(date).toISOString().startsWith(date);
}

function decodeChat(value: unknown): ChatHistoryMessage {
  if (!isRecord(value)) throw new Error("Invalid chat record");
  const { chatId, role, message, imageUrl, jobId, createdAt } = value;
  if (
    typeof chatId !== "string" ||
    (role !== "USER" && role !== "ASSISTANT") ||
    typeof message !== "string" ||
    !isNullableString(imageUrl) ||
    !isNullableString(jobId) ||
    !isIsoDate(createdAt)
  ) {
    throw new Error("Invalid chat record");
  }

  return { chatId, role, message, imageUrl, jobId, createdAt };
}

function decodeChatHistory(value: unknown): ChatHistoryPage {
  if (!isRecord(value)) throw new Error("Invalid chat history");
  const { hasNext, nextCursor, chats } = value;
  if (typeof hasNext !== "boolean" || !isNullableString(nextCursor) || !Array.isArray(chats)) {
    throw new Error("Invalid chat history");
  }

  return { hasNext, nextCursor, chats: chats.map(decodeChat) };
}

/** Retrieves one page in server order. Callers explicitly request subsequent pages. */
export async function getChatHistory({ cursor, size, signal, authSnapshot }: ChatHistoryOptions = {}): Promise<ChatHistoryPage> {
  signal?.throwIfAborted();

  const query = new URLSearchParams();
  if (cursor !== undefined) {
    if (typeof cursor !== "string" || cursor.trim() === "") {
      throw new ChatInputError("cursor", "채팅 기록 커서는 비어 있지 않은 문자열이어야 합니다.");
    }
    query.set("cursor", cursor);
  }
  if (size !== undefined) {
    if (!Number.isInteger(size) || size < 1 || size > 100) {
      throw new ChatInputError("size", "채팅 기록 페이지 크기는 1~100 사이의 정수여야 합니다.");
    }
    query.set("size", String(size));
  }

  const search = query.size === 0 ? "" : `?${query}`;
  return apiClient.get(`/chats/messages${search}`, { signal, authSnapshot, cache: "no-store", decode: decodeChatHistory });
}
