"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";

interface PrinterDisconnectedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPrinterManagement: () => void;
  stlUrl: string;
}

export function PrinterDisconnectedModal({
  isOpen,
  onClose,
  onOpenPrinterManagement,
  stlUrl,
}: PrinterDisconnectedModalProps) {
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const dialog = dialogRef.current;
    const previousActiveElement = document.activeElement;
    const getFocusableElements = () =>
      Array.from(dialog?.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]") ?? []);

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = getFocusableElements();
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (!firstElement || !lastElement) {
        event.preventDefault();
        dialog?.focus();
        return;
      }

      if (!dialog?.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? lastElement : firstElement).focus();
      } else if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    (getFocusableElements()[0] ?? dialog)?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      if (previousActiveElement instanceof HTMLElement && previousActiveElement.isConnected) {
        previousActiveElement.focus();
      }
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
        ref={dialogRef}
        tabIndex={-1}
        aria-labelledby="printer-disconnected-title"
        aria-modal="true"
        className="w-full max-w-[460px] rounded-2xl bg-white p-5 shadow-2xl sm:p-7"
        role="dialog"
      >
        <div className="relative text-center">
          <h2 id="printer-disconnected-title" className="text-base font-bold text-gray-950">
            프린터에 연결되지 않았어요
          </h2>
          <p className="mt-3 text-xs leading-5 text-gray-500">
            프린터 연결을 진행 했는지 확인해 주세요.
            <br />
            연결 정보는 프린터 관리에서 확인할 수 있어요.
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="프린터 연결 안내 닫기"
            title="닫기"
            className="absolute right-0 top-0 text-gray-400 transition-colors hover:text-gray-700"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 rounded-xl bg-gray-50 p-3">
          <a
            href={stlUrl}
            download
            className="block rounded-lg border border-gray-200 bg-white px-4 py-3 transition-colors hover:bg-gray-50"
          >
            <p className="text-sm font-bold text-gray-950">STL 파일 내려받기</p>
            <p className="mt-1 text-xs text-gray-400">바로 출력 가능한 파일</p>
          </a>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-12 rounded-lg border border-gray-200 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={onOpenPrinterManagement}
            className="h-12 rounded-lg bg-[#5a7bff] text-sm font-semibold text-white transition-colors hover:bg-[#4a6ee5]"
          >
            프린터 관리로 이동
          </button>
        </div>
      </section>
    </div>
  );
}
