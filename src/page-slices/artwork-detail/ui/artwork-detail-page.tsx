"use client";

import { ArrowLeft, Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ArtworkDetail, FilamentColor } from "@/entities/artwork";
import { LikeButton } from "@/features/like-artwork";
import { ArtworkModelPreview } from "@/features/stl-viewer";
import { Header } from "@/widgets/header";

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
      <Header />
      <main className="box-border min-h-[calc(100vh-73px)] w-full overflow-x-hidden bg-[#fbfbfb] px-4 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-12 2xl:px-16">
        <div className="mx-auto max-w-[1600px]">
          <button
          type="button"
          onClick={() => router.back()}
          aria-label="이전 페이지로 돌아가기"
          title="이전 페이지로 돌아가기"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-gray-950 shadow-sm ring-1 ring-black/[0.04] transition hover:-translate-x-0.5 hover:shadow-md sm:h-16 sm:w-16"
        >
          <ArrowLeft className="h-7 w-7" strokeWidth={2.4} aria-hidden="true" />
          </button>

          <section className="mt-6 grid w-full gap-8 rounded-[32px] bg-white p-4 shadow-[0_8px_24px_rgba(0,0,0,0.08)] sm:mt-7 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12 lg:p-8 2xl:gap-16">
          <div className="flex min-w-0 flex-col">
            <ArtworkModelPreview url={stlUrl} />

            <div className="mt-6 flex items-start justify-between gap-4">
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
              <div className="mt-4 flex flex-wrap items-center gap-3 sm:gap-4">
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

            <div className="mt-10 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:gap-6">
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
