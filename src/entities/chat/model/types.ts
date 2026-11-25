import type { AuthSnapshot } from "@/shared/api/auth";

export interface ChatHistoryMessage {
  chatId: string;
  role: "USER" | "ASSISTANT";
  message: string;
  imageUrl: string | null;
  jobId: string | null;
  createdAt: string;
}

export interface ChatHistoryPage {
  hasNext: boolean;
  nextCursor: string | null;
  chats: ChatHistoryMessage[];
}

export interface ChatHistoryOptions {
  authSnapshot?: AuthSnapshot;
  cursor?: string;
  size?: number;
  signal?: AbortSignal;
}
