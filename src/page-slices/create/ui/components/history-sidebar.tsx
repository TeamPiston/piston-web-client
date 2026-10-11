"use client";

import { Plus, X } from "lucide-react";
import type { KeyboardEvent } from "react";
import type { ChatHistory } from "../../model/types";

interface HistorySidebarProps {
  chatHistories: ChatHistory[];
  editingHistoryId: string | null;
  editingHistoryTitle: string;
  historyTitleInputRef: React.RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onEditTitle: (history: ChatHistory) => void;
  onNewChat: () => void;
  onSaveTitle: () => void;
  onTitleChange: (value: string) => void;
  onTitleKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}

export function HistorySidebar({
  chatHistories,
  editingHistoryId,
  editingHistoryTitle,
  historyTitleInputRef,
  onClose,
  onEditTitle,
  onNewChat,
  onSaveTitle,
  onTitleChange,
  onTitleKeyDown,
}: HistorySidebarProps) {
  return (
    <aside className="flex h-full w-full flex-col rounded-r-2xl bg-white px-5 py-6 shadow-lg">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-950">채팅</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="채팅 히스토리 닫기"
          title="닫기"
          className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-950"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <button
        type="button"
        onClick={onNewChat}
        className="mt-6 flex h-11 items-center justify-center gap-2 rounded-lg bg-[#5a7bff] text-sm font-semibold text-white transition-colors hover:bg-[#4a6ee5]"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        새 채팅
      </button>

      <p className="mt-8 text-xs font-semibold text-gray-400">이전 채팅</p>
      <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto">
        {chatHistories.map((history) => {
          const isEditing = editingHistoryId === history.id;

          return (
            <div
              key={history.id}
              role="button"
              tabIndex={0}
              onDoubleClick={() => onEditTitle(history)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !isEditing) {
                  onEditTitle(history);
                }
              }}
              className="rounded-lg px-3 py-3 text-sm text-gray-700 transition-colors hover:bg-gray-50"
            >
              {isEditing ? (
                <input
                  ref={historyTitleInputRef}
                  value={editingHistoryTitle}
                  onChange={(event) => onTitleChange(event.target.value)}
                  onBlur={onSaveTitle}
                  onKeyDown={onTitleKeyDown}
                  aria-label="채팅 제목 수정"
                  className="w-full rounded border border-[#5a7bff] bg-white px-2 py-1 text-sm text-gray-950 outline-none"
                />
              ) : (
                <span className="block truncate">{history.title}</span>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
