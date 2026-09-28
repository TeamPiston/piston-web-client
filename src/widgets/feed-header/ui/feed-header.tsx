import Link from "next/link";
import { CircleUserRound } from "lucide-react";
import { PistonLogo } from "@/shared/ui";

export function FeedHeader() {
  return (
    <header className="sticky top-0 z-20 flex w-full items-center gap-3 border-b border-gray-100 bg-white/85 px-4 py-3 backdrop-blur-sm sm:gap-6 sm:px-6 sm:py-4 lg:px-10 xl:px-12">
      <span className="shrink-0">
        <PistonLogo />
      </span>

      <nav className="flex min-w-0 flex-1 items-center justify-center gap-5 text-xs font-medium text-gray-700 sm:gap-8 sm:text-sm">
        <Link href="/create" className="transition-colors hover:text-gray-950">
          Create
        </Link>
        <Link href="/feed" className="font-semibold text-blue-500">
          Feed
        </Link>
      </nav>

      <Link href="/login" aria-label="로그인" className="shrink-0 text-gray-900 transition-colors hover:text-gray-600">
        <CircleUserRound className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={1.25} />
      </Link>
    </header>
  );
}
