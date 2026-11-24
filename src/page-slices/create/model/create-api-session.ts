import { getChatHistory, type ChatHistoryOptions } from "@/entities/chat";
import { generateImageTo3D, generateTextTo3D, getMeshyTaskStatus } from "@/features/generate-3d-model";
import { sendChatMessage } from "@/features/send-chat-message";
import { ApiAuthPreflightError, ApiError } from "@/shared/api";
import { captureAuth, type AuthSnapshot } from "@/shared/api/auth";
import type { CreateApiTransport, GetVerifiedCreateAccountScope } from "./create-api-generation-flow";

export async function getCreateAccountScope(userId: string) {
  const input = new TextEncoder().encode("piston:create:v1:" + userId);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function captureSession(sessionId: string) {
  const snapshot = captureAuth();
  return snapshot.session?.id === sessionId && snapshot.accessToken ? snapshot : null;
}

export function bindCreateApi(sessionId: string, accountScope: string) {
  const getVerifiedAccountScope: GetVerifiedCreateAccountScope = (purpose, previousSessionId) => {
    if (!captureSession(sessionId)) return null;
    if (purpose === "reauthentication" && (!previousSessionId || previousSessionId === sessionId)) return null;
    return accountScope;
  };

  async function request<T>(signal: AbortSignal | undefined, send: (authSnapshot: AuthSnapshot) => Promise<T>) {
    signal?.throwIfAborted();
    const authSnapshot = captureSession(sessionId);
    if (!authSnapshot) throw new ApiAuthPreflightError("로그인 세션을 확인할 수 없습니다.");
    const result = await send(authSnapshot);
    signal?.throwIfAborted();
    if (!captureSession(sessionId)) throw new ApiError("로그인 세션이 변경되었습니다.", 401, null);
    return result;
  }

  const transport: CreateApiTransport = {
    sendChatMessage: (input, options = {}) => request(options.signal,
      (authSnapshot) => sendChatMessage(input, { ...options, authSnapshot })),
    generateTextTo3D: (input, options = {}) => request(options.signal,
      (authSnapshot) => generateTextTo3D(input, { ...options, authSnapshot })),
    generateImageTo3D: (input, options = {}) => request(options.signal,
      (authSnapshot) => generateImageTo3D(input, { ...options, authSnapshot })),
    getMeshyTaskStatus: (taskId, options = {}) => request(options.signal,
      (authSnapshot) => getMeshyTaskStatus(taskId, { ...options, authSnapshot })),
  };

  return {
    transport,
    getVerifiedAccountScope,
    getHistory: (options: ChatHistoryOptions) => request(options.signal,
      (authSnapshot) => getChatHistory({ ...options, authSnapshot })),
  };
}
