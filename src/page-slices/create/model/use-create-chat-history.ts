"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/shared/api";
import type { ChatHistoryMessage, ChatHistoryOptions, ChatHistoryPage } from "@/entities/chat";

export type GetCreateHistory = (options: ChatHistoryOptions) => Promise<ChatHistoryPage>;

export function useCreateChatHistory(getHistory?: GetCreateHistory) {
  const [{ chats, nextCursor }, setHistory] = useState<{
    chats: ChatHistoryMessage[];
    nextCursor: string | null;
  }>({ chats: [], nextCursor: null });
  const [loading, setLoading] = useState(!!getHistory);
  const [error, setError] = useState("");
  const inFlight = useRef<AbortController | null>(null);
  const requestedCursor = useRef<string | undefined>(undefined);
  const usedCursors = useRef(new Set<string>());

  const load = useCallback(async (cursor?: string) => {
    if (!getHistory || inFlight.current) return;
    const controller = new AbortController();
    inFlight.current = controller;
    requestedCursor.current = cursor;
    try {
      const page = await getHistory({ cursor, size: 30, signal: controller.signal });
      if (inFlight.current !== controller) return;
      if (page.hasNext && (!page.nextCursor?.trim() || page.nextCursor === cursor || usedCursors.current.has(page.nextCursor))) {
        throw new Error("Invalid chat continuation cursor");
      }
      if (cursor !== undefined) usedCursors.current.add(cursor);
      setHistory((previous) => {
        const combined = new Map(previous.chats.map((chat) => [chat.chatId, chat]));
        const overlaps = page.chats.some((chat) => combined.has(chat.chatId));
        for (const chat of page.chats) combined.set(chat.chatId, chat);
        const chats = Array.from(combined.values()).sort((a, b) =>
          Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
          a.chatId.localeCompare(b.chatId, "en", { numeric: true }));
        return {
          chats,
          // A refreshed newest page can reuse the older cursor only when it overlaps the loaded range.
          nextCursor: !page.hasNext ? null : cursor === undefined && overlaps
            ? previous.nextCursor : page.nextCursor,
        };
      });
    } catch (cause) {
      if (inFlight.current !== controller) return;
      setError(cause instanceof ApiError && cause.status === 401
        ? "로그인 상태를 확인한 뒤 채팅 기록을 다시 불러와 주세요."
        : "채팅 기록을 불러오지 못했어요.");
    } finally {
      if (inFlight.current === controller) {
        inFlight.current = null;
        setLoading(false);
      }
    }
  }, [getHistory]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void load(); });
    return () => {
      active = false;
      inFlight.current?.abort();
      inFlight.current = null;
    };
  }, [load]);

  const refreshLatest = useCallback(() => {
    if (!getHistory) return;
    const previous = inFlight.current;
    inFlight.current = null;
    previous?.abort();
    usedCursors.current.clear();
    setLoading(true);
    setError("");
    void load();
  }, [getHistory, load]);

  function loadPage(cursor?: string) {
    if (!getHistory || inFlight.current) return;
    setLoading(true);
    setError("");
    void load(cursor);
  }

  return {
    chats, loading, error, hasMore: nextCursor !== null, refreshLatest,
    loadMore: () => { if (nextCursor !== null) loadPage(nextCursor); },
    retry: () => { loadPage(requestedCursor.current); },
  };
}
