"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import type { FilamentColor } from "@/entities/artwork";

type PrintColorMode = "color" | "monochrome";

interface PrintSettingsModalProps {
  isOpen: boolean;
  isPrinterConnected?: boolean;
  estimatedPrintTime: string;
  filamentColors: FilamentColor[];
  filamentUsage: {
    length: string;
    weight: string;
  };
  errorMessage?: string | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: (settings: { colorMode: string }) => void;
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
  estimatedPrintTime,
  filamentColors,
  filamentUsage,
  errorMessage = null,
  isSubmitting = false,
  onClose,
  onConfirm,
}: PrintSettingsModalProps) {
  const [colorMode, setColorMode] = useState<PrintColorMode>("color");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
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
        aria-labelledby="print-settings-title"
        aria-modal="true"
        className="max-h-[calc(100dvh-2rem)] w-full max-w-[460px] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-7"
        role="dialog"
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
                  <p className="text-sm font-bold text-gray-950">MAX4_02</p>
                  <p className="mt-1 truncate text-xs text-gray-400">
                    QIDI X-Max 4 · 192.168.0.24 · 연결됨
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
    </div>
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
