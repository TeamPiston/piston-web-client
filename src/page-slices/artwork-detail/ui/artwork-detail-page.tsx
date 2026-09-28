"use client";

import { ArrowLeft, Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ArtworkDetail, FilamentColor } from "@/entities/artwork";
import { LikeButton } from "@/features/like-artwork";
import { ArtworkModelPreview } from "@/features/stl-viewer";
import { FeedHeader } from "@/widgets/feed-header";

interface ArtworkDetailPageProps {
  artwork: ArtworkDetail;
}

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
  const [isQueued, setIsQueued] = useState(false);

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

  return (
    <>
      <FeedHeader />
      <main className="min-h-[calc(100vh-73px)] w-full bg-[#fbfbfb] px-4 py-8 sm:px-8 lg:px-16 lg:py-14">
        <div className="mx-auto max-w-[1200px]">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="이전 페이지로 돌아가기"
          title="이전 페이지로 돌아가기"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-gray-950 shadow-sm ring-1 ring-black/[0.04] transition hover:-translate-x-0.5 hover:shadow-md"
        >
          <ArrowLeft className="h-7 w-7" strokeWidth={2.4} aria-hidden="true" />
        </button>

        <section className="mt-7 grid w-full gap-10 rounded-[32px] bg-white p-6 shadow-[0_8px_24px_rgba(0,0,0,0.08)] sm:p-8 lg:h-[600px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12 lg:p-8">
          <div className="flex min-w-0 flex-col">
            <ArtworkModelPreview url={stlUrl} />

            <div className="mt-6 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="max-w-[12ch] truncate text-lg font-semibold text-gray-950">
                  {artwork.title.slice(0, 12)}
                </h1>
                <p className="mt-2 text-sm text-gray-400">
                  {artwork.author}(제작자)
                </p>
              </div>

              <LikeButton className="h-10 w-10 bg-white" />
            </div>

            <button
              type="button"
              onClick={() => setIsQueued(true)}
              className="mt-8 h-12 w-full rounded-lg bg-[#5a7bff] text-sm font-semibold text-white transition hover:bg-[#4a6ee5] active:scale-[0.99]"
            >
              {isQueued ? "출력 대기 중" : "출력하기"}
            </button>
          </div>

          <div className="flex min-w-0 flex-col justify-between">
            <p className="max-h-[270px] overflow-y-auto pr-2 text-sm leading-6 text-gray-950">
              {description}
            </p>

            <div className="mt-10">
              <p className="text-sm font-medium text-gray-950">필요한 필라멘트 색상</p>
              <div className="mt-4 flex items-center gap-4">
                {filamentColors.map((color) => (
                  <span
                    key={color.name}
                    aria-label={color.name}
                    title={color.name}
                    className="h-9 w-9 rounded-full ring-1 ring-black/[0.03]"
                    style={{ backgroundColor: color.value }}
                  />
                ))}
              </div>
            </div>

            <div className="mt-10 grid grid-cols-[1fr_auto] items-end gap-6">
              <div>
                <p className="text-sm font-medium text-gray-950">필요한 필라멘트 사용량</p>
                <p className="mt-3 text-xl font-semibold tracking-normal text-gray-950">
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
                className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f0f0f0] text-gray-950 transition hover:bg-[#e5e5e5]"
              >
                <Download className="h-6 w-6" aria-hidden="true" />
              </a>
            </div>

            <div className="mt-9">
              <p className="text-sm font-medium text-gray-950">예상 출력 시간</p>
              <p className="mt-3 text-xl font-semibold text-gray-950">
                {estimatedPrintTime}
              </p>
            </div>
          </div>
        </section>
        </div>
      </main>
    </>
  );
}
