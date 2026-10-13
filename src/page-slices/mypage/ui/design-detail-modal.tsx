"use client";

import { Download, Move } from "lucide-react";
import { useEffect, useState } from "react";
import { ArtworkModelPreview } from "@/features/stl-viewer";
import { DeleteDesignConfirmModal } from "./delete-design-confirm-modal";

export interface MyDesign {
  colorMode?: "color" | "monochrome";
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
  const [colorModeSelection, setColorModeSelection] = useState<{
    designId: string;
    mode: "color" | "monochrome";
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    if (!design) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isDeleteConfirmOpen) {
          setIsDeleteConfirmOpen(false);
        } else {
          onClose();
        }
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [design, isDeleteConfirmOpen, onClose]);

  if (!design) {
    return null;
  }

  const colorMode = colorModeSelection?.designId === design.id
    ? colorModeSelection.mode
    : design.colorMode ?? "color";

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

  const handleDelete = () => {
    onDelete(design.id);
    setIsDeleteConfirmOpen(false);
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
        className="w-full max-w-[480px] overflow-hidden rounded-3xl bg-white p-6 shadow-2xl"
        role="dialog"
      >
        <div className="relative flex h-[220px] items-center justify-center rounded-2xl bg-[#F7F7F8] p-6">
          <ArtworkModelPreview
            stlUrl={design.stlUrl}
            variant="detail-compact"
            showFullscreenControl={false}
          />
          <Move
            className="pointer-events-none absolute bottom-4 right-4 h-6 w-6 text-gray-900"
            aria-hidden="true"
          />
        </div>

        <div className="mt-6">
          <h2 id="design-detail-title" className="text-lg font-bold text-gray-900">
            {design.title}
          </h2>
          <p className="mt-1 text-xs text-gray-400">
            {design.createdAt} · {design.printCount > 0 ? `${design.printCount}회 출력` : "아직 출력 안 함"}
          </p>
        </div>

        <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl bg-[#F7F7F8] p-4">
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900">Feed에 공개</p>
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
                "relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200",
                design.isPublished ? "bg-[#5C7CFF]" : "bg-gray-300",
              ].join(" ")}
            >
              <span
                className={[
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200",
                  design.isPublished ? "translate-x-0.3" : "-translate-x-5",
                ].join(" ")}
              />
            </button>
        </div>

        <fieldset className="mt-5">
          <legend className="text-sm font-bold text-gray-900">출력 색상</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 rounded-2xl bg-[#F7F7F8] p-1.5">
            <button
              type="button"
              aria-pressed={colorMode === "color"}
              onClick={() => setColorModeSelection({ designId: design.id, mode: "color" })}
              className={[
                "flex min-w-0 items-center gap-3 rounded-xl p-3 text-left transition-colors",
                colorMode === "color" ? "bg-white shadow-sm" : "opacity-60",
              ].join(" ")}
            >
              <span className="flex shrink-0 gap-1" aria-hidden="true">
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-orange-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                <span className="h-2.5 w-2.5 rounded-full bg-lime-400" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-gray-900">컬러</span>
                <span className="mt-0.5 block whitespace-nowrap text-[10px] text-gray-400">
                  여러 색 필라멘트 사용
                </span>
              </span>
            </button>
            <button
              type="button"
              aria-pressed={colorMode === "monochrome"}
              onClick={() => setColorModeSelection({ designId: design.id, mode: "monochrome" })}
              className={[
                "flex min-w-0 items-center gap-3 rounded-xl p-3 text-left transition-colors",
                colorMode === "monochrome" ? "bg-white shadow-sm" : "opacity-60",
              ].join(" ")}
            >
              <span className="flex shrink-0 gap-1" aria-hidden="true">
                <span className="h-2.5 w-2.5 rounded-full border border-gray-300 bg-white" />
                <span className="h-2.5 w-2.5 rounded-full bg-gray-900" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-gray-900">흑백</span>
                <span className="mt-0.5 block whitespace-nowrap text-[10px] text-gray-400">
                  흰색과 검정만 사용
                </span>
              </span>
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            흑백으로 출력하면 필라멘트를 바꿔 끼우지 않아도 돼요.
          </p>
        </fieldset>

        <dl className="mt-4 space-y-2 rounded-2xl bg-[#F7F7F8] p-4 text-xs">
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">크기</dt>
            <dd className="text-right font-bold text-gray-900">{design.dimensions}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">예상 출력 시간</dt>
            <dd className="text-right font-bold text-gray-900">{design.estimatedPrintTime}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">필요한 필라멘트</dt>
            <dd className="text-right font-bold text-gray-900">
              {design.filamentLength} / {design.filamentWeight}
            </dd>
          </div>
        </dl>

        {printError && (
          <p className="mt-3 text-xs text-red-500" role="alert">
            {printError}
          </p>
        )}

        <div className="mt-6 grid grid-cols-[72px_minmax(0,1fr)_minmax(0,1fr)] gap-2">
          <button
            type="button"
            onClick={() => setIsDeleteConfirmOpen(true)}
            className="h-12 rounded-xl border border-red-200 bg-white text-sm font-medium text-red-500 transition-colors hover:bg-red-50 cursor-pointer"
          >
            삭제
          </button>
          <a
            href={design.stlUrl}
            download
            className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
            파일 내려받기
          </a>
          <button
            type="button"
            onClick={() => void handlePrint()}
            disabled={isSubmitting}
            className="h-12 rounded-xl bg-[#5C7CFF] text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
          >
            {isSubmitting ? "요청 중..." : "출력하기"}
          </button>
        </div>
      </section>
      <DeleteDesignConfirmModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
