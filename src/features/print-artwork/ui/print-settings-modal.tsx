"use client";

import { X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { FilamentColor } from "@/entities/artwork";
import type { Printer } from "@/entities/printer";

type PrintColorMode = "color" | "monochrome";

interface PrintSettingsModalProps {
  isOpen: boolean;
  isPrinterConnected?: boolean;
  printer?: Printer | null;
  estimatedPrintTime: string;
  filamentColors: FilamentColor[];
  filamentUsage: {
    length: string;
    weight: string;
  };
  errorMessage?: string | null;
  isSubmitting?: boolean;
  returnFocusRef?: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onConfirm: (settings: { colorMode: string }) => void;
  onOpenPrinterManagement: () => void;
}

const printChecklist = [
  "사용할 3D 프린터가 연결되어 있는지",
  "사용할 필라멘트가 남아 있는지",
  "디자인이 프린터 출력 규격에 맞는지",
  "프린터에 이전 출력물이 남아 있지 않은지",
];

export function PrintSettingsModal({
  isOpen,
  isPrinterConnected = false,
  printer,
  estimatedPrintTime,
  filamentColors,
  filamentUsage,
  errorMessage = null,
  isSubmitting = false,
  returnFocusRef,
  onClose,
  onConfirm,
  onOpenPrinterManagement,
}: PrintSettingsModalProps) {
  const [colorMode, setColorMode] = useState<PrintColorMode>("color");
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const returnFocusTarget = returnFocusRef?.current ?? previousFocus;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";

    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      if (
        returnFocusTarget instanceof HTMLElement && returnFocusTarget.isConnected &&
        !returnFocusTarget.matches(":disabled") && returnFocusTarget.getClientRects().length > 0
      ) {
        returnFocusTarget.focus({ preventScroll: true });
      }
    };
  }, [isOpen, returnFocusRef]);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    // Disabling the focused submit button can move focus to the document body.
    if (isOpen && dialog?.open && !dialog.contains(document.activeElement)) {
      dialog.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    }
  }, [isOpen, isSubmitting]);

  if (!isOpen) {
    return null;
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="print-settings-title"
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none items-center justify-center bg-transparent p-4 backdrop:bg-black/40 open:flex"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const buttons = Array.from(
          event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
        ).filter((button) => button.getClientRects().length > 0);
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <section
        className="max-h-[calc(100dvh-2rem)] w-full max-w-[460px] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-7"
      >
        <div className="relative text-center">
          <h2 id="print-settings-title" className="text-base font-bold text-gray-950">
            출력 전 꼭 확인해 주세요
          </h2>
          <p className="mt-3 text-xs text-gray-400">
            아래 항목을 확인한 뒤 출력을 시작해 주세요.
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="출력 설정 닫기"
            title="닫기"
            className="absolute right-0 top-0 text-gray-400 transition-colors hover:text-gray-700"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-7 space-y-5">
          <fieldset>
            <legend className="mb-2 text-xs font-bold text-gray-950">출력할 프린터</legend>
            {isPrinterConnected ? (
              <div className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3">
                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-950">{printer?.name}</p>
                  <p className="mt-1 truncate text-xs text-gray-400">
                    {printer?.model} · {printer?.ipAddress} · 연결됨
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3">
                <span className="h-2 w-2 shrink-0 rounded-full bg-gray-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-950">연결된 프린터가 없어요</p>
                  <p className="mt-1 truncate text-xs text-gray-400">
                    프린터를 등록하면 바로 출력할 수 있어요.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onOpenPrinterManagement}
                  className="shrink-0 rounded-lg bg-[#5a7bff] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#4a6ee5]"
                >
                  프린터 등록
                </button>
              </div>
            )}
          </fieldset>

          <fieldset disabled={!isPrinterConnected} className={!isPrinterConnected ? "opacity-40" : undefined}>
            <legend className="mb-2 text-xs font-bold text-gray-950">출력 색상</legend>
            <div className="grid grid-cols-2 gap-2">
              <ColorModeOption
                isSelected={colorMode === "color"}
                disabled={!isPrinterConnected}
                label="컬러"
                description="여러 색 필라멘트 사용"
                onSelect={() => setColorMode("color")}
              >
                <span className="flex items-center gap-1">
                  {filamentColors.slice(0, 4).map((color) => (
                    <span
                      key={color.name}
                      className="h-2.5 w-2.5 rounded-full ring-1 ring-black/[0.04]"
                      style={{ backgroundColor: color.value }}
                    />
                  ))}
                </span>
              </ColorModeOption>
              <ColorModeOption
                isSelected={colorMode === "monochrome"}
                disabled={!isPrinterConnected}
                label="흑백"
                description="흰색과 검정만 사용"
                onSelect={() => setColorMode("monochrome")}
              >
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full border border-gray-300 bg-white" />
                  <span className="h-2.5 w-2.5 rounded-full bg-gray-950" />
                </span>
              </ColorModeOption>
            </div>
            <p className="mt-2 text-[11px] text-gray-400">
              흑백으로 출력하면 필라멘트를 바꿔 끼우지 않아도 돼요.
            </p>
          </fieldset>

          <div className={[
            "grid grid-cols-2 rounded-xl bg-gray-50 p-4 text-center",
            !isPrinterConnected && "opacity-40",
          ].filter(Boolean).join(" ")}>
            <div>
              <p className="text-[10px] font-medium text-gray-400">예상 출력 시간</p>
              <p className="mt-2 text-base font-semibold text-gray-950">{estimatedPrintTime}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium text-gray-400">필라멘트 사용량</p>
              <p className="mt-2 text-base font-semibold text-gray-950">
                {filamentUsage.length} / {filamentUsage.weight}
              </p>
            </div>
          </div>

          <ol className={[
            "space-y-3 rounded-xl bg-gray-50 p-4",
            !isPrinterConnected && "opacity-40",
          ].filter(Boolean).join(" ")}>
            {printChecklist.map((item, index) => (
              <li key={item} className="flex gap-3 text-xs font-medium text-gray-700">
                <span className="font-semibold text-[#5a7bff]">{index + 1}.</span>
                <span>{item}</span>
              </li>
            ))}
          </ol>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-12 rounded-lg border border-gray-200 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => onConfirm({ colorMode })}
              disabled={!isPrinterConnected || isSubmitting}
              className="h-12 rounded-lg bg-[#5a7bff] text-sm font-semibold text-white transition-colors hover:bg-[#4a6ee5] disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {isSubmitting ? "출력 시작 중..." : "출력 시작하기"}
            </button>
          </div>
          {errorMessage && (
            <p className="mt-3 text-center text-xs font-medium text-red-500" role="alert">
              {errorMessage}
            </p>
          )}
        </div>
      </section>
    </dialog>
  );
}

interface ColorModeOptionProps {
  children: React.ReactNode;
  description: string;
  disabled: boolean;
  isSelected: boolean;
  label: string;
  onSelect: () => void;
}

function ColorModeOption({
  children,
  description,
  disabled,
  isSelected,
  label,
  onSelect,
}: ColorModeOptionProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={isSelected}
      className={[
        "flex min-w-0 flex-col items-center justify-center rounded-lg px-2 py-3 text-center transition-colors",
        disabled && "cursor-not-allowed",
        isSelected
          ? "bg-white shadow-sm ring-1 ring-gray-100"
          : "bg-gray-50 hover:bg-gray-100",
      ].join(" ")}
    >
      <span className="flex h-5 items-center gap-2">
        {children}
        <span className={isSelected ? "text-xs font-semibold text-[#5a7bff]" : "text-xs font-semibold text-gray-500"}>
          {label}
        </span>
      </span>
      <span className="mt-2 text-[10px] text-gray-400">{description}</span>
    </button>
  );
}
