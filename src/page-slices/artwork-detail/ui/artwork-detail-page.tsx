"use client";

import { ArrowLeft, Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ArtworkDetail, FilamentColor } from "@/entities/artwork";
import { LikeButton } from "@/features/like-artwork";
import { PrintSettingsModal } from "@/features/print-artwork";
import { ArtworkModelPreview } from "@/features/stl-viewer";
import { Header } from "@/widgets/header";

interface ArtworkDetailPageProps {
  artwork: ArtworkDetail;
}

type PrintStatus = "idle" | "printing" | "failed";

const FALLBACK_STL_URL = "/pencil-holder.stl";
const FALLBACK_FILAMENT_COLORS: FilamentColor[] = [
  { name: "빨강", value: "#f04444" },
  { name: "주황", value: "#ff7855" },
  { name: "노랑", value: "#ffd166" },
  { name: "초록", value: "#0dcc9a" },
  { name: "파랑", value: "#5a7bff" },
];

export default function ArtworkDetailPage({ artwork }: ArtworkDetailPageProps) {
  const router = useRouter();
  const [printStatus, setPrintStatus] = useState<PrintStatus>("idle");
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const stlUrl = artwork.stlUrl ?? FALLBACK_STL_URL;
  const description =
    artwork.description ??
    artwork.title + "에 대한 상세 설명을 확인할 수 있는 작품입니다.";
  const filamentColors =
    Array.isArray(artwork.filamentColors) && artwork.filamentColors.length > 0
      ? artwork.filamentColors
      : FALLBACK_FILAMENT_COLORS;
  const filamentUsage = artwork.filamentUsage ?? {
    length: "12m",
    weight: "36g",
  };
  const estimatedPrintTime = artwork.estimatedPrintTime ?? "1시간";
  const isQueued = printStatus === "printing";

  const handlePrintConfirm = () => {
    setIsPrintModalOpen(false);

    // Replace this mock result with the printer API response when it is connected.
    const isPrinterConnected = true;
    setPrintStatus(isPrinterConnected ? "printing" : "failed");
  };

  return (
    <>
      <Header />
      <main className="box-border min-h-[calc(100vh-73px)] w-full overflow-x-hidden bg-[#fbfbfb] px-4 py-3 sm:px-8 sm:py-4 lg:h-[calc(100vh-73px)] lg:overflow-hidden lg:px-12 lg:py-4 2xl:px-16">
        {printStatus !== "idle" && (
          <div
            role="status"
            aria-live="polite"
            className={[
              "mx-auto mb-2 max-w-[1600px] text-center text-base font-semibold leading-6",
              printStatus === "printing" ? "text-[#5a7bff]" : "text-red-500",
            ].join(" ")}
          >
            {printStatus === "printing" ? (
              <>
                <p>출력이 시작되었습니다.</p>
                <p>마이페이지에서 출력 상황을 확인해 주세요!</p>
              </>
            ) : (
              <>
                <p>출력을 실패했습니다.</p>
                <p>주의 사항을 확인해 주세요.</p>
              </>
            )}
          </div>
        )}

        <div className="mx-auto max-w-[1600px]">
          <button
          type="button"
          onClick={() => router.back()}
          aria-label="이전 페이지로 돌아가기"
          title="이전 페이지로 돌아가기"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-950 shadow-sm ring-1 ring-black/[0.04] transition hover:-translate-x-0.5 hover:shadow-md sm:h-12 sm:w-12"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2.4} aria-hidden="true" />
          </button>

          <section className="mt-3 grid w-full gap-6 rounded-[28px] bg-white p-3 shadow-[0_8px_24px_rgba(0,0,0,0.08)] sm:mt-4 sm:p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-8 lg:p-5 2xl:gap-10">
          <div className="flex min-w-0 flex-col">
            <ArtworkModelPreview url={stlUrl} />

            <div className="mt-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="max-w-[20ch] truncate text-lg font-semibold text-gray-950 sm:text-xl">
                  {artwork.title}
                </h1>
                <p className="mt-2 text-sm text-gray-400">
                  {artwork.author}(제작자)
                </p>
              </div>

              <LikeButton className="h-10 w-10 bg-white" />
            </div>

            <button
              type="button"
              onClick={() => setIsPrintModalOpen(true)}
              disabled={isQueued}
              className="mt-5 h-11 w-full rounded-lg bg-[#5a7bff] text-sm font-semibold text-white transition hover:bg-[#4a6ee5] active:scale-[0.99] disabled:cursor-default disabled:hover:bg-[#5a7bff]"
            >
              {isQueued ? "출력 대기 중" : "출력하기"}
            </button>
          </div>

          <div className="flex min-w-0 flex-col justify-between">
            <p className="max-h-[180px] overflow-y-auto pr-2 text-xs leading-5 text-gray-950 lg:max-h-[190px]">
              {description}
            </p>

            <div className="mt-5">
              <p className="text-xs font-medium text-gray-950">필요한 필라멘트 색상</p>
              <div className="mt-3 flex flex-wrap items-center gap-3 sm:gap-4">
                {filamentColors.map((color) => (
                  <span
                    key={color.name}
                    aria-label={color.name}
                    title={color.name}
                    className="h-8 w-8 rounded-full ring-1 ring-black/[0.03]"
                    style={{ backgroundColor: color.value }}
                  />
                ))}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:gap-6">
              <div>
                <p className="text-xs font-medium text-gray-950">필요한 필라멘트 사용량</p>
                <p className="mt-2 text-lg font-semibold tracking-normal text-gray-950">
                  {filamentUsage.length}
                  <span className="px-2 text-gray-300">|</span>
                  {filamentUsage.weight}
                </p>
              </div>

              <a
                href={stlUrl}
                download
                aria-label="3D 모델 다운로드"
                title="3D 모델 다운로드"
                className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f0f0f0] text-gray-950 transition hover:bg-[#e5e5e5]"
              >
                <Download className="h-5 w-5" aria-hidden="true" />
              </a>
            </div>

            <div className="mt-5">
              <p className="text-xs font-medium text-gray-950">예상 출력 시간</p>
              <p className="mt-2 text-lg font-semibold text-gray-950">
                {estimatedPrintTime}
              </p>
            </div>
          </div>
          </section>
        </div>
      </main>
      <PrintSettingsModal
        isOpen={isPrintModalOpen}
        estimatedPrintTime={estimatedPrintTime}
        filamentColors={filamentColors}
        filamentUsage={filamentUsage}
        onClose={() => setIsPrintModalOpen(false)}
        onConfirm={handlePrintConfirm}
      />
    </>
  );
}
