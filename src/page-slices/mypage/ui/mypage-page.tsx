"use client";

import { CircleUserRound } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useState } from "react";
import { useAuth } from "@/entities/session";
import { Header } from "@/widgets/header";
import { PrinterManagementPage } from "./printer-management-page";

type PrintStatus = "COMPLETED" | "EMPTY" | "PRINTING";

interface CreatedDesign {
  href: string;
  isPublished: boolean;
  meta: string;
  title: string;
}

const MOCK_PROFILE = {
  email: "penamjin@gmail.com",
  name: "dlskawls",
};

const MOCK_CREATED_DESIGNS: CreatedDesign[] = [
  {
    href: "/artwork/6",
    isPublished: true,
    meta: "어제 만듦 · 1회 출력",
    title: "화분 받침 트레이",
  },
  {
    href: "/artwork/7",
    isPublished: false,
    meta: "3일 전 만듦 · 2회 출력",
    title: "벽걸이 케이블 훅",
  },
  {
    href: "/artwork/8",
    isPublished: true,
    meta: "1주 전 만듦 · 아직 출력 안 함",
    title: "헤드폰 거치대",
  },
];

export default function MyPage() {
  return (
    <Suspense fallback={null}>
      <MyPageContent />
    </Suspense>
  );
}

function MyPageContent() {
  const searchParams = useSearchParams();
  const isPrinterTab = searchParams.get("tab") === "printer";
  const isEmptyPreview = searchParams.get("empty") === "true";

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1920px] flex-col overflow-x-clip bg-[#fbfbfb] xl:h-dvh xl:min-h-0 xl:overflow-hidden">
      <Header />
      {isPrinterTab ? (
        <PrinterManagementPage
          key={isEmptyPreview ? "empty-printers" : "default-printers"}
          initialPrinters={isEmptyPreview ? [] : undefined}
        />
      ) : (
        <MyProfilePage />
      )}
    </div>
  );
}

function MyProfilePage() {
  const router = useRouter();
  const { logout, user } = useAuth();
  const [printStatus] = useState<PrintStatus>("PRINTING");

  const displayProfile = user && user.name !== "관리자" ? user : MOCK_PROFILE;

  return (
    <>
      <main className="mx-auto flex min-h-[calc(100dvh-var(--header-height))] w-full max-w-[1264px] flex-1 flex-col px-4 py-10 sm:px-8 xl:h-[calc(100dvh-var(--header-height))] xl:min-h-0 xl:flex-none xl:overflow-y-auto">
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

        {printStatus === "EMPTY" ? (
          <EmptyPrintState />
        ) : (
          <>
            <PrintStatusSection status={printStatus} />
            <CreatedDesignSection />
          </>
        )}
      </main>
    </>
  );
}

function PrintStatusSection({ status }: { status: Exclude<PrintStatus, "EMPTY"> }) {
  const isCompleted = status === "COMPLETED";
  const progress = isCompleted ? 100 : 62;

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
          <h3 className="mt-4 text-xl font-bold text-gray-950">육각형 연필꽂이</h3>
          <div className="mt-4 flex items-center justify-between gap-4">
            <span className="text-lg font-bold text-gray-950">{progress}%</span>
            <span className="text-xs text-gray-500">
              {isCompleted
                ? "오늘 15:12 완료 · 프린터에서 꺼내 주세요"
                : "약 32분 남음 · 오늘 15:12 완료 예정"}
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

function CreatedDesignSection() {
  return (
    <section className="mt-14 pb-12">
      <h2 className="text-xl font-bold text-gray-950">내가 만든 디자인</h2>
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {MOCK_CREATED_DESIGNS.map((design) => (
          <Link
            key={design.title}
            href={design.href}
            className="overflow-hidden rounded-2xl border border-gray-300 bg-white transition-shadow hover:shadow-md"
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
              <p className="mt-2 text-xs text-gray-400">{design.meta}</p>
            </div>
          </Link>
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
