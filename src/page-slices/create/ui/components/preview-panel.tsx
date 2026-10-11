"use client";

import { Download, Minus, Move3d, Plus } from "lucide-react";
import { ArtworkModelPreview } from "@/features/stl-viewer";
import { PistonLogo } from "@/shared/ui";
import type { PrintSuccessPhase, ResolvedArtworkModelParams } from "../../model/types";

interface PreviewPanelProps {
  cameraDistance: number;
  isGenerated: boolean;
  isPrintBlocked: boolean;
  modelParams: ResolvedArtworkModelParams;
  onPrint: () => void;
  printSuccessPhase: PrintSuccessPhase;
  onZoom: (direction: "in" | "out") => void;
}

export function PreviewPanel({
  cameraDistance,
  isGenerated,
  isPrintBlocked,
  modelParams,
  onPrint,
  printSuccessPhase,
  onZoom,
}: PreviewPanelProps) {
  return (
    <section className="flex min-h-[720px] min-w-0 flex-col items-center bg-white px-6 pb-8 pt-20 lg:pt-[120px] xl:min-h-0">
      <div className="relative h-[600px] w-full max-w-[432px]">
        {printSuccessPhase !== "hidden" && (
          <div
            role="status"
            aria-live="polite"
            className={[
              "pointer-events-none absolute -top-20 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap text-center transition-opacity duration-500",
              printSuccessPhase === "fading" ? "opacity-0" : "opacity-100",
            ].join(" ")}
          >
            <p className="font-semibold text-blue-600">출력이 시작되었습니다.</p>
            <p className="font-semibold text-blue-600">
              마이페이지에서 출력 상황을 확인해 주세요!
            </p>
          </div>
        )}
        {isGenerated ? (
          <>
            <ArtworkModelPreview
              cameraDistance={cameraDistance}
              color={modelParams.color}
              scale={modelParams.scale}
              stlUrl={modelParams.stlUrl}
              variant="create"
            />
            <div className="absolute left-1/2 top-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white px-4 py-2 text-xs text-gray-500 shadow-md ring-1 ring-black/[0.04]">
              <Move3d className="h-4 w-4 text-gray-950" aria-hidden="true" />
              드래그해서 돌려보세요
            </div>
            <div className="absolute bottom-4 right-4 flex flex-col overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-black/[0.06]">
              <button
                type="button"
                onClick={() => onZoom("in")}
                aria-label="확대"
                title="확대"
                className="flex h-10 w-10 items-center justify-center text-gray-950 transition-colors hover:bg-gray-50"
              >
                <Plus className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onZoom("out")}
                aria-label="축소"
                title="축소"
                className="flex h-10 w-10 items-center justify-center border-t border-gray-100 text-gray-950 transition-colors hover:bg-gray-50"
              >
                <Minus className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-[28px] bg-[#f6f6f6]">
            <PistonLogo height={24} />
          </div>
        )}
      </div>

      <div className="mt-5 grid w-full max-w-[432px] grid-cols-[minmax(0,1fr)_48px] gap-7">
        <button
          type="button"
          onClick={onPrint}
          disabled={!isGenerated || isPrintBlocked}
          className="h-12 rounded-lg bg-[#5a7bff] text-sm font-semibold text-white transition-colors hover:bg-[#4a6ee5] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-white"
        >
          {isGenerated ? "출력하기" : "디자인을 생성해 주세요."}
        </button>
        {isGenerated ? (
          <a
            href={modelParams.stlUrl}
            download
            aria-label="3D 모델 다운로드"
            title="3D 모델 다운로드"
            className="flex h-12 w-12 items-center justify-center rounded-lg border border-gray-200 text-[#5a7bff] transition-colors hover:bg-gray-50"
          >
            <Download className="h-5 w-5" aria-hidden="true" />
          </a>
        ) : (
          <button
            type="button"
            disabled
            aria-label="3D 모델 다운로드 비활성화"
            title="디자인 생성 후 다운로드할 수 있어요"
            className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-300 text-white"
          >
            <Download className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>
      <p className="mt-4 max-w-[432px] text-center text-xs leading-5 text-gray-400">
        생성한 디자인은 기본으로 비공개예요.
        <br />
        Feed에 올리려면 마이페이지에서 공개로 바꿔 주세요.
      </p>
    </section>
  );
}
