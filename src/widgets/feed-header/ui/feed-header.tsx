import Link from "next/link";
import { CircleUserRound } from "lucide-react";
import { PistonLogo } from "@/shared/ui";

export function FeedHeader() {
  return (
    <header className="sticky top-0 z-20 grid w-full grid-cols-3 items-center px-12 py-4 bg-white/85 backdrop-blur-sm">
      <span className="justify-self-start">
        <PistonLogo />
      </span>

      <nav className="flex w-full max-w-[200px] justify-self-center items-center justify-between text-sm font-medium text-gray-700">
        <Link href="/create" className="transition-colors hover:text-gray-950">
          Create
        </Link>
        <Link href="/feed" className="font-semibold text-blue-500">
          Feed
        </Link>
      </nav>

      <Link href="/login" className="justify-self-end text-gray-900 transition-colors hover:text-gray-600">
        <CircleUserRound className="h-8 w-8" strokeWidth={1.25} />
      </Link>
    </header>
  );
}
