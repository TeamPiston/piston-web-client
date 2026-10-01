"use client";

import { Download, Move3d, X } from "lucide-react";
import { useEffect, useState } from "react";
import { ArtworkModelPreview } from "@/features/stl-viewer";

export interface MyDesign {
  createdAt: string;
  dimensions: string;
  estimatedPrintTime: string;
  filamentLength: string;
  filamentWeight: string;
  id: string;
  isPublished: boolean;
  printCount: number;
  stlUrl: string;
  title: string;
}

interface DesignDetailModalProps {
  design: MyDesign | null;
  onClose: () => void;
  onDelete: (designId: string) => void;
  onPrint: (artworkName: string) => Promise<void>;
  onTogglePublished: (designId: string) => void;
}

export function DesignDetailModal({
  design,
  onClose,
  onDelete,
  onPrint,
  onTogglePublished,
}: DesignDetailModalProps) {
  const [colorMode, setColorMode] = useState<"color" | "monochrome">("color");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);

  useEffect(() => {
    if (!design) {
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
  }, [design, onClose]);

  if (!design) {
    return null;
  }

  const handlePrint = async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setPrintError(null);

    try {
      await onPrint(design.title);
      onClose();
    } catch {
      setPrintError("출력을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        aria-labelledby="design-detail-title"
        aria-modal="true"
        className="relative max-h-[calc(100dvh-1.5rem)] w-full max-w-[620px] overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:max-h-[calc(100dvh-3rem)] sm:p-6"
        role="dialog"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="디자인 상세 닫기"
          title="닫기"
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-gray-500 shadow-sm transition-colors hover:text-gray-950 sm:right-6 sm:top-6"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        <div className="relative rounded-2xl bg-gray-100 p-3 sm:p-5">
          <ArtworkModelPreview stlUrl={design.stlUrl} variant="detail" />
          <div className="pointer-events-none absolute bottom-5 right-5 flex items-center gap-1 rounded-full bg-white/90 px-3 py-2 text-[11px] text-gray-500 shadow-sm">
            <Move3d className="h-3.5 w-3.5" aria-hidden="true" />
            드래그하여 회전 · 확대
          </div>
        </div>

        <div className="mt-5">
          <h2 id="design-detail-title" className="pr-10 text-lg font-bold text-gray-950">
            {design.title}
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            {design.createdAt} · {design.printCount > 0 ? `${design.printCount}회 출력` : "아직 출력 안 함"}
          </p>
        </div>

        <div className="mt-5 flex items-center justify-between gap-4 rounded-xl bg-gray-50 p-4">
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-950">Feed에 공개</p>
            <p className="mt-1 text-xs leading-5 text-gray-400">
              공개하면 다른 사용자가 프롬프트와 결과물을 볼 수 있어요.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={design.isPublished}
            aria-label="Feed 공개 여부"
            onClick={() => onTogglePublished(design.id)}
            className={[
              "relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors",
              design.isPublished ? "bg-[#5a7bff]" : "bg-gray-300",
            ].join(" ")}
          >
            <span
              className={[
                "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                design.isPublished ? "translate-x-[22px]" : "translate-x-0.5",
              ].join(" ")}
            />
          </button>
        </div>

        <fieldset className="mt-5">
          <legend className="mb-2 text-sm font-bold text-gray-950">출력 색상</legend>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-pressed={colorMode === "color"}
              onClick={() => setColorMode("color")}
              className={[
                "rounded-lg border p-3 text-left transition-colors",
                colorMode === "color" ? "border-[#5a7bff] bg-blue-50" : "border-gray-200 bg-white",
              ].join(" ")}
            >
              <span className="block text-sm font-semibold text-gray-950">컬러</span>
              <span className="mt-1 block text-xs text-gray-400">여러 색 필라멘트 사용</span>
            </button>
            <button
              type="button"
              aria-pressed={colorMode === "monochrome"}
              onClick={() => setColorMode("monochrome")}
              className={[
                "rounded-lg border p-3 text-left transition-colors",
                colorMode === "monochrome" ? "border-[#5a7bff] bg-blue-50" : "border-gray-200 bg-white",
              ].join(" ")}
            >
              <span className="block text-sm font-semibold text-gray-950">흑백</span>
              <span className="mt-1 block text-xs text-gray-400">흰색과 검정만 사용</span>
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            흑백으로 출력하면 필라멘트를 바꿔 끼우지 않아도 돼요.
          </p>
        </fieldset>

        <dl className="mt-5 space-y-2 rounded-xl bg-gray-50 p-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">크기</dt>
            <dd className="text-right font-medium text-gray-950">{design.dimensions}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">예상 출력 시간</dt>
            <dd className="text-right font-medium text-gray-950">{design.estimatedPrintTime}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">필요한 필라멘트</dt>
            <dd className="text-right font-medium text-gray-950">
              {design.filamentLength} / {design.filamentWeight}
            </dd>
          </div>
        </dl>

        {printError && (
          <p className="mt-3 text-xs text-red-500" role="alert">
            {printError}
          </p>
        )}

        <div className="mt-5 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => onDelete(design.id)}
            className="h-11 rounded-lg border border-red-200 text-sm font-medium text-red-500 transition-colors hover:bg-red-50"
          >
            삭제
          </button>
          <a
            href={design.stlUrl}
            download
            className="flex h-11 items-center justify-center gap-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            파일 내려받기
          </a>
          <button
            type="button"
            onClick={() => void handlePrint()}
            disabled={isSubmitting}
            className="h-11 rounded-lg bg-[#5a7bff] text-sm font-semibold text-white transition-colors hover:bg-[#4a6ee5] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "요청 중..." : "출력하기"}
          </button>
        </div>
      </section>
    </div>
  );
}
