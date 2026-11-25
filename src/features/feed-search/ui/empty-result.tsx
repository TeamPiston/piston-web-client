import Link from "next/link";

interface EmptyResultProps {
  query: string;
}

export function EmptyResult({ query }: EmptyResultProps) {
  return (
    <section
      aria-live="polite"
      className="flex min-h-[328px] w-full items-center justify-center rounded-lg bg-[#f5f5f5] px-6 py-12 text-center"
    >
      <div>
        <h2 className="text-lg font-bold text-gray-950">
          &apos;{query}&apos;에 대한 결과가 없어요
        </h2>
        <p className="mt-3 text-sm text-gray-400">
          다른 검색어를 써보거나, 직접 만들어 보세요.
        </p>
        <Link
          href="/create"
          className="mt-8 inline-flex h-14 items-center justify-center rounded-lg bg-[#5b7fff] px-8 text-sm font-semibold text-white transition-colors hover:bg-[#4a6ee5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b7fff] focus-visible:ring-offset-2"
        >
          직접 만들기
        </Link>
      </div>
    </section>
  );
}
