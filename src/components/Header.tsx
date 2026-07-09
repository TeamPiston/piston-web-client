import Link from "next/link";
import { PistonLogo } from "@/components/PistonLogo";

export function Header() {
  return (
    <header className="sticky top-0 z-20 grid w-full grid-cols-3 items-center px-12 py-4 bg-white/80 backdrop-blur-sm border-b border-gray-100">
      <span className="justify-self-start">
        <PistonLogo />
      </span>

      <nav className="flex w-full max-w-xs justify-self-center items-center justify-between text-sm font-medium text-gray-700">
        <Link href="/create" className="transition-colors hover:text-gray-950">
          Create
        </Link>
        <Link href="/feed" className="transition-colors hover:text-gray-950">
          Feed
        </Link>
      </nav>

      <Link
        href="/login"
        className="justify-self-end rounded bg-[#1e1e1e] px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        로그인
      </Link>
    </header>
  );
}
