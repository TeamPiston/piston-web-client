"use client";

import { CircleUserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { createPrintTask, getCurrentPrintTask, type PrintTask } from "@/entities/print";
import { useAuth } from "@/entities/session";
import { Header } from "@/widgets/header";
import { DesignDetailModal, type MyDesign } from "./design-detail-modal";

const MOCK_PROFILE = {
  email: "penamjin@gmail.com",
  name: "dlskawls",
};

const INITIAL_CREATED_DESIGNS: MyDesign[] = [
  {
    id: "plant-tray",
    createdAt: "어제 만듦",
    printCount: 1,
    isPublished: true,
    stlUrl: "/models/mini-tray.stl",
    dimensions: "120 × 120 × 40 mm",
    estimatedPrintTime: "1시간 24분",
    filamentLength: "12 m",
    filamentWeight: "36 g",
    title: "화분 받침 트레이",
  },
  {
    id: "cable-hook",
    createdAt: "3일 전 만듦",
    printCount: 2,
    isPublished: false,
    stlUrl: "/models/cable-holder.stl",
    dimensions: "80 × 36 × 22 mm",
    estimatedPrintTime: "48분",
    filamentLength: "9 m",
    filamentWeight: "27 g",
    title: "벽걸이 케이블 훅",
  },
  {
    id: "headphone-stand",
    createdAt: "1주 전 만듦",
    printCount: 0,
    isPublished: true,
    stlUrl: "/models/desk-stand.stl",
    dimensions: "120 × 120 × 40 mm",
    estimatedPrintTime: "1시간 24분",
    filamentLength: "12 m",
    filamentWeight: "36 g",
    title: "헤드폰 거치대",
  },
];

export default function MyPage() {
  const router = useRouter();
  const { logout, user } = useAuth();
  const [printTask, setPrintTask] = useState<PrintTask | null | undefined>(undefined);
  const [isPrintLoading, setIsPrintLoading] = useState(true);
  const [hasPrintLoadError, setHasPrintLoadError] = useState(false);
  const [createdDesigns, setCreatedDesigns] = useState(INITIAL_CREATED_DESIGNS);
  const [selectedDesign, setSelectedDesign] = useState<MyDesign | null>(null);

  const closeDesignModal = useCallback(() => setSelectedDesign(null), []);

  const loadCurrentPrint = useCallback(async () => {
    try {
      const nextPrintTask = await getCurrentPrintTask();
      setPrintTask(nextPrintTask);
      setHasPrintLoadError(false);
    } catch {
      setHasPrintLoadError(true);
    } finally {
      setIsPrintLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoadId = window.setTimeout(() => {
      void loadCurrentPrint();
    }, 0);

    return () => window.clearTimeout(initialLoadId);
  }, [loadCurrentPrint]);

  useEffect(() => {
    if (printTask?.status !== "PRINTING") {
      return;
    }

    const pollingId = window.setInterval(() => {
      void loadCurrentPrint();
    }, 3000);

    return () => window.clearInterval(pollingId);
  }, [loadCurrentPrint, printTask?.status]);

  const displayProfile = user && user.name !== "관리자" ? user : MOCK_PROFILE;

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#fbfbfb]">
      <Header />
      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col px-4 py-10 sm:px-8 lg:px-0">
        <section className="flex flex-col gap-6 rounded-2xl border border-gray-300 bg-white px-6 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <div className="flex min-w-0 items-center gap-6">
            <CircleUserRound
              className="h-14 w-14 shrink-0 text-[#5a7bff]"
              strokeWidth={1.6}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-950">{displayProfile.name}</h1>
              <p className="mt-1 text-sm text-gray-500">{displayProfile.email}</p>
              <p className="mt-1 text-xs text-gray-400">프린터는 한 번에 하나만 출력할 수 있어요.</p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() => router.push("/mypage?tab=printer")}
              className="h-11 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-950 transition-colors hover:bg-gray-50"
            >
              프린터 관리
            </button>
            <button
              type="button"
              onClick={logout}
              className="h-11 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50"
            >
              로그아웃
            </button>
            <button
              type="button"
              className="h-11 rounded-lg border border-gray-300 px-4 text-sm font-medium text-red-500 transition-colors hover:bg-red-50"
            >
              회원탈퇴
            </button>
          </div>
        </section>

        {printTask === undefined && (
          <PrintLoadState
            hasError={hasPrintLoadError}
            isLoading={isPrintLoading}
            onRetry={() => {
              setIsPrintLoading(true);
              void loadCurrentPrint();
            }}
          />
        )}
        {(printTask === null || printTask?.status === "EMPTY") && <EmptyPrintState />}
        {printTask && printTask.status !== "EMPTY" && (
          <PrintStatusSection printTask={printTask} />
        )}
        <CreatedDesignSection
          designs={createdDesigns}
          onSelect={setSelectedDesign}
        />
      </main>
      <DesignDetailModal
        design={selectedDesign}
        onClose={closeDesignModal}
        onDelete={(designId) => {
          setCreatedDesigns((designs) => designs.filter((design) => design.id !== designId));
          setSelectedDesign(null);
        }}
        onPrint={async (artworkName) => {
          const nextPrintTask = await createPrintTask(artworkName);
          setPrintTask(nextPrintTask);
        }}
        onTogglePublished={(designId) => {
          setCreatedDesigns((designs) =>
            designs.map((design) =>
              design.id === designId
                ? { ...design, isPublished: !design.isPublished }
                : design,
            ),
          );
          setSelectedDesign((design) =>
            design?.id === designId
              ? { ...design, isPublished: !design.isPublished }
              : design,
          );
        }}
      />
    </div>
  );
}

function PrintStatusSection({ printTask }: { printTask: PrintTask }) {
  const isCompleted = printTask.status === "COMPLETED";
  const progress = Math.min(100, Math.max(0, printTask.progress));
  const remainingText = isCompleted
    ? printTask.estimatedEndTime
    : `약 ${printTask.remainingMinutes}분 남음 · ${printTask.estimatedEndTime}`;

  return (
    <section className="mt-12">
      <h2 className="text-xl font-bold text-gray-950">내 출력</h2>
      <article className="mt-6 flex flex-col gap-6 rounded-2xl border border-gray-300 bg-white p-6 sm:flex-row sm:items-center sm:p-7">
        <div className="h-40 w-full shrink-0 rounded-xl bg-[#f6f6f6] sm:w-40" />
        <div className="min-w-0 flex-1">
          <div
            className={[
              "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold",
              isCompleted ? "bg-emerald-50 text-emerald-500" : "bg-blue-50 text-blue-500",
            ].join(" ")}
          >
            <span aria-hidden="true">●</span>
            {isCompleted ? "출력 완료" : "출력 중"}
          </div>
          <h3 className="mt-4 text-xl font-bold text-gray-950">{printTask.artworkName}</h3>
          <div className="mt-4 flex items-center justify-between gap-4">
            <span className="text-lg font-bold text-gray-950">{progress}%</span>
            <span className="text-xs text-gray-500">
              {remainingText}
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200">
            <div
              className={[
                "h-full rounded-full transition-[width]",
                isCompleted ? "bg-emerald-400" : "bg-[#5a7bff]",
              ].join(" ")}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </article>
    </section>
  );
}

function PrintLoadState({
  hasError,
  isLoading,
  onRetry,
}: {
  hasError: boolean;
  isLoading: boolean;
  onRetry: () => void;
}) {
  return (
    <section className="mt-24 flex min-h-[315px] flex-col items-center justify-center rounded-2xl bg-[#f6f6f6] px-6 text-center">
      <h2 className="text-xl font-bold text-gray-950">
        {hasError ? "출력 상태를 불러오지 못했어요" : "출력 상태를 불러오는 중이에요"}
      </h2>
      {hasError && (
        <button
          type="button"
          onClick={onRetry}
          disabled={isLoading}
          className="mt-8 h-12 rounded-lg border border-gray-300 bg-white px-6 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          다시 시도
        </button>
      )}
    </section>
  );
}

function CreatedDesignSection({
  designs,
  onSelect,
}: {
  designs: MyDesign[];
  onSelect: (design: MyDesign) => void;
}) {
  return (
    <section className="mt-14 pb-12">
      <h2 className="text-xl font-bold text-gray-950">내가 만든 디자인</h2>
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {designs.map((design) => (
          <button
            key={design.id}
            type="button"
            onClick={() => onSelect(design)}
            aria-label={`${design.title} 상세 보기`}
            className="overflow-hidden rounded-2xl border border-gray-300 bg-white text-left transition-shadow hover:shadow-md"
          >
            <div className="relative h-40 bg-[#f6f6f6] p-3">
              <span
                className={[
                  "inline-flex items-center gap-1 rounded-full border bg-white px-3 py-1 text-xs font-medium",
                  design.isPublished
                    ? "border-blue-100 text-[#5a7bff]"
                    : "border-gray-200 text-gray-500",
                ].join(" ")}
              >
                <span aria-hidden="true">•</span>
                {design.isPublished ? "Feed 공개" : "비공개"}
              </span>
            </div>
            <div className="border-t border-gray-100 px-5 py-4">
              <h3 className="truncate text-base font-bold text-gray-950">{design.title}</h3>
              <p className="mt-2 text-xs text-gray-400">
                {design.createdAt} · {design.printCount > 0 ? `${design.printCount}회 출력` : "아직 출력 안 함"}
              </p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function EmptyPrintState() {
  return (
    <section className="mt-24 flex min-h-[315px] flex-col items-center justify-center rounded-2xl bg-[#f6f6f6] px-6 text-center">
      <h2 className="text-xl font-bold text-gray-950">아직 출력한 디자인이 없어요</h2>
      <p className="mt-3 text-sm text-gray-500">
        직접 만들어도 되고, Feed에서 다른 사람이 만든 디자인을 골라도 돼요.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/create"
          className="flex h-12 items-center justify-center rounded-lg bg-[#5a7bff] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#4a6ee5]"
        >
          새 디자인 만들기
        </Link>
        <Link
          href="/feed"
          className="flex h-12 items-center justify-center rounded-lg border border-gray-300 bg-white px-6 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
        >
          Feed에서 디자인 찾아보기
        </Link>
      </div>
    </section>
  );
}
