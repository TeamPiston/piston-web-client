"use client";

import { X } from "lucide-react";
import { useEffect } from "react";
import type { PrintTask } from "@/entities/print";

interface PrintInProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenMyPage: () => void;
  printTask: PrintTask;
}

export function PrintInProgressModal({
  isOpen,
  onClose,
  onOpenMyPage,
  printTask,
}: PrintInProgressModalProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        aria-labelledby="print-in-progress-title"
        aria-modal="true"
        className="w-full max-w-[460px] rounded-2xl bg-white p-5 shadow-2xl sm:p-7"
        role="dialog"
      >
        <div className="relative text-center">
          <h2 id="print-in-progress-title" className="text-base font-semibold text-gray-950">
            지금은 출력할 수 없어요
          </h2>
          <p className="mt-3 text-xs leading-5 text-gray-500">
            프린터는 한 번에 하나만 출력할 수 있어요.
            <br />
            먼저 시작한 출력이 끝나면 다시 시도해 주세요.
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="출력 중 안내 닫기"
            title="닫기"
            className="absolute right-0 top-0 text-gray-400 transition-colors hover:text-gray-700"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-6 flex items-center gap-4 rounded-lg bg-gray-50 p-4">
          <div className="h-12 w-12 shrink-0 rounded-lg bg-white" aria-hidden="true" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-gray-950">
              MAX4_02에서 {printTask.artworkName} 출력 중
            </p>
            <p className="mt-1 text-xs text-gray-400">
              약 {printTask.remainingMinutes}분 남음 · {printTask.estimatedEndTime}
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-12 rounded-lg border border-gray-200 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={onOpenMyPage}
            className="h-12 rounded-lg bg-[#5a7bff] text-sm font-semibold text-white transition-colors hover:bg-[#4a6ee5]"
          >
            출력 상황 보기
          </button>
        </div>
      </section>
    </div>
  );
}
