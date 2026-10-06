"use client";

import { useEffect, useState } from "react";
import type { PrintTask } from "@/entities/print";

interface PrintRetryConfirmModalProps {
  onClose: () => void;
  onConfirm: () => Promise<void>;
  printTask: PrintTask;
}

const FILAMENT_COLORS = ["#F5CD55", "#F48C54", "#5C7CFF", "#70D6A6"];

export function PrintRetryConfirmModal({
  onClose,
  onConfirm,
  printTask,
}: PrintRetryConfirmModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasColorFilament, setHasColorFilament] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const stoppedTime = formatStoppedTime(printTask.stoppedAt);
  const filamentRemaining = printTask.filamentRemaining ?? "12 m / 36 g";

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) {
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
  }, [isSubmitting, onClose]);

  const handleConfirm = async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await onConfirm();
    } catch {
      setErrorMessage("출력을 시작하지 못했어요. 프린터 연결을 확인하고 다시 시도해 주세요.");
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <section
        aria-labelledby="print-retry-title"
        aria-modal="true"
        className="max-h-[calc(100dvh-2rem)] w-full max-w-[480px] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
        role="dialog"
      >
        <header className="text-center">
          <h2 id="print-retry-title" className="text-lg font-bold text-gray-950">
            다시 출력하기 전에 확인해 주세요
          </h2>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            지난 출력이 중단됐어요.
            <br />
            같은 문제가 반복되지 않도록 아래를 점검해 주세요.
          </p>
        </header>

        <div className="my-4 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50/30 p-3 text-xs font-semibold text-red-500">
          <span aria-hidden="true">●</span>
          <span>
            지난 실패 · {stoppedTime ? `${stoppedTime} 중단` : "중단 시각 확인 필요"}
          </span>
        </div>

        <div className="space-y-3 rounded-2xl bg-[#F7F7F8] p-4 text-xs">
          <ChecklistItem title="노즐 청소" description="막힌 필라멘트 찌꺼기를 제거했는지" />
          <ChecklistItem
            title="필라멘트 잔량"
            description={`이번 출력에도 ${filamentRemaining} 이 필요해요`}
          />
          <ChecklistItem title="잔여물 정리" description="이전 출력물이나 잔여물이 남아 있지 않은지" />
          <ChecklistItem
            title="프린터 연결"
            description={`${printTask.printerName ?? "MAX4_02"} · 연결됨`}
          />
          <div className="flex items-start gap-3">
            <input
              checked={hasColorFilament}
              onChange={(event) => setHasColorFilament(event.target.checked)}
              aria-label="필요한 색 필라멘트가 장착되어 있어요"
              className="mt-0.5 h-5 w-5 shrink-0 accent-[#5C7CFF]"
              type="checkbox"
            />
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-bold text-gray-950">
                출력 색상
                <span className="flex items-center gap-1" aria-label="노랑, 주황, 파랑, 연두">
                  {FILAMENT_COLORS.map((color) => (
                    <span
                      key={color}
                      aria-hidden="true"
                      className="h-2.5 w-2.5 rounded-full ring-1 ring-black/[0.04]"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </span>
              </p>
              <p className="mt-1 text-gray-500">
                컬러로 출력해요 · 필요한 색 필라멘트가 끼워져 있는지
              </p>
            </div>
          </div>
        </div>

        {errorMessage && (
          <p className="mt-3 text-xs text-red-500" role="alert">
            {errorMessage}
          </p>
        )}

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-12 flex-1 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={isSubmitting}
            className="h-12 flex-1 rounded-xl bg-[#5C7CFF] text-sm font-bold text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "출력 시작 중..." : "점검했어요, 출력 시작"}
          </button>
        </div>
      </section>
    </div>
  );
}

function ChecklistItem({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <p className="font-bold text-gray-950">{title}</p>
      <p className="mt-1 text-gray-500">{description}</p>
    </div>
  );
}

function formatStoppedTime(value?: string) {
  if (!value) {
    return null;
  }

  const timeMatch = value.match(/(?:^|T)(\d{2}:\d{2})/);
  if (timeMatch) {
    return timeMatch[1];
  }

  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(timestamp);
}
