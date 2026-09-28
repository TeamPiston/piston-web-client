import Link from "next/link";
import { PistonLogo } from "@/shared/ui";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-20 flex w-full items-center gap-3 border-b border-gray-100 bg-white/80 px-4 py-3 backdrop-blur-sm sm:gap-6 sm:px-6 sm:py-4 lg:px-10 xl:px-12">
      <span className="shrink-0">
        <PistonLogo />
      </span>

      <nav className="flex min-w-0 flex-1 items-center justify-center gap-5 text-xs font-medium text-gray-700 sm:gap-8 sm:text-sm">
        <Link href="/create" className="transition-colors hover:text-gray-950">
          Create
        </Link>
        <Link href="/feed" className="transition-colors hover:text-gray-950">
          Feed
        </Link>
      </nav>

      <Link
        href="/login"
        className="shrink-0 rounded bg-[#1e1e1e] px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 sm:px-4 sm:text-sm"
      >
        로그인
      </Link>
    </header>
  );
}
