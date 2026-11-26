"use client";

import { useRef, useState, type RefObject } from "react";
import { useNativeDialog } from "@/shared/ui/use-native-dialog";
import { ArtworkModelPreview } from "@/features/stl-viewer";
import type { PrintTask } from "@/entities/print";
import { isMockModeEnabled, MOCK_ACCOUNT_SETTINGS } from "@/shared/mock/mock-data";
import { DemoNotice } from "@/shared/ui/demo-notice";

interface PrintStatusDetailModalProps {
  filamentRemaining: string;
  modelUrl?: string;
  onCancel?: () => Promise<void>;
  onClose: () => void;
  printTask: PrintTask;
  returnFocusRef?: RefObject<HTMLButtonElement | null>;
  getFallbackFocusTargets?: () => readonly (HTMLElement | null)[];
}

export function PrintStatusDetailModal({
  filamentRemaining,
  modelUrl,
  onCancel,
  onClose,
  printTask,
  returnFocusRef,
  getFallbackFocusTargets,
}: PrintStatusDetailModalProps) {
  const cancelling = useRef(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const isMock = isMockModeEnabled();
  const isPrinting = printTask.status === "PRINTING";
  const progress = Math.min(100, Math.max(0, printTask.progress));

  const handleClose = () => {
    if (!cancelling.current) onClose();
  };
  const { dialogRef, onCancel: onDialogCancel } = useNativeDialog({
    onClose: handleClose, initialFocusRef: closeButton, returnFocusRef, getFallbackFocusTargets,
  });

  const handleCancel = async () => {
    if (!onCancel || cancelling.current || !isPrinting) {
      return;
    }

    cancelling.current = true;
    title.current?.focus({ preventScroll: true });
    setIsCancelling(true);
    setCancelError(null);

    try {
      await onCancel();
    } catch {
      setCancelError("출력을 취소하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      cancelling.current = false;
      setIsCancelling(false);
    }
  };

  const timeSummary = isPrinting
    ? `약 ${printTask.remainingMinutes}분 남음 (${printTask.estimatedEndTime || "완료 시간 확인 중"})`
    : printTask.estimatedEndTime || "출력이 완료됐어요.";

  return (
    <dialog
      ref={dialogRef}
      aria-describedby="print-status-detail-description"
      aria-labelledby="print-status-detail-title"
      aria-modal="true"
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none items-center justify-center bg-transparent p-4 backdrop:bg-black/45 open:flex"
      onCancel={onDialogCancel}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
    >
      <section className="max-h-full w-full max-w-[480px] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <DemoNotice isVisible={isMock} className="mb-3">
          <p>화면에 표시된 출력 상태는 데모 데이터예요. 실제 프린터는 작동하지 않습니다.</p>
        </DemoNotice>
        <div className="relative flex h-[220px] items-center justify-center rounded-2xl bg-[#F7F7F8] p-5">
          {modelUrl && (
            <ArtworkModelPreview stlUrl={modelUrl} variant="detail-compact" showFullscreenControl={false} />
          )}
          <span
            className={[
              "absolute right-4 top-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold",
              isPrinting ? "bg-blue-50 text-[#5C7CFF]" : "bg-emerald-50 text-emerald-600",
            ].join(" ")}
          >
            <span
              className={[
                "h-1.5 w-1.5 rounded-full",
                isPrinting ? "bg-[#5C7CFF]" : "bg-emerald-500",
              ].join(" ")}
              aria-hidden="true"
            />
            {isPrinting ? "출력 중" : "출력 완료"}
          </span>
        </div>

        <div className="mt-5">
          <h2 ref={title} id="print-status-detail-title" tabIndex={-1} className="text-lg font-bold text-gray-900">
            {printTask.artworkName}
          </h2>
          <p id="print-status-detail-description" className="mt-1 text-xs text-gray-400">
            {isPrinting ? `${progress}% 진행됨` : "출력이 완료됐어요."}
          </p>
        </div>

        <div className="mt-4 h-3 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-[#5C7CFF] transition-[width]"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="mt-3 text-sm font-semibold text-gray-900">{timeSummary}</p>

        <dl className="mt-5 space-y-3 rounded-2xl bg-[#F7F7F8] p-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">프린터 이름</dt>
            <dd className="text-right font-semibold text-gray-900">
              {printTask.printerName || (isMock ? MOCK_ACCOUNT_SETTINGS.printerName : "정보 없음")}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">출력 방식</dt>
            <dd className="text-right font-semibold text-gray-900">
              {printTask.printingMethod || (isMock ? "FDM" : "정보 없음")}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">필라멘트 잔여량</dt>
            <dd className="text-right font-semibold text-gray-900">{filamentRemaining}</dd>
          </div>
        </dl>

        {cancelError && (
          <p className="mt-3 text-xs text-red-500" role="alert">
            {cancelError}
          </p>
        )}

        <div className={onCancel ? "mt-5 grid grid-cols-2 gap-2" : "mt-5 grid"}>
          {onCancel && (
            <button
              type="button"
              onClick={() => void handleCancel()}
              disabled={!isPrinting || isCancelling}
              className="h-12 rounded-xl border border-red-200 bg-white text-sm font-medium text-red-500 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCancelling ? "취소 중..." : "출력 취소"}
            </button>
          )}
          <button
            type="button"
            ref={closeButton}
            onClick={handleClose}
            disabled={isCancelling}
            className="h-12 rounded-xl bg-[#5C7CFF] text-sm font-bold text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            확인
          </button>
        </div>
      </section>
    </dialog>
  );
}
