"use client";

import { CircleUserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/entities/session";
import { PistonLogo } from "@/shared/ui";

const navigationItems = [
  { href: "/create", label: "Create" },
  { href: "/feed", label: "Feed" },
];

export function Header() {
  const pathname = usePathname();
  const { isLoggedIn, logout } = useAuth();

  return (
    <header className="sticky top-0 z-20 flex w-full items-center justify-between gap-4 border-b border-gray-100 bg-white/85 px-4 py-3 backdrop-blur-sm sm:gap-6 sm:px-6 sm:py-4 lg:px-10 xl:px-12">
      <span className="shrink-0">
        <PistonLogo />
      </span>

      <nav className="flex min-w-0 flex-1 items-center justify-center gap-5 text-xs font-medium text-gray-700 sm:gap-8 sm:text-sm">
        {navigationItems.map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                isActive
                  ? "font-semibold text-blue-500"
                  : "transition-colors hover:text-gray-950"
              }
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {isLoggedIn ? (
        <button
          type="button"
          onClick={logout}
          aria-label="로그아웃"
          title="로그아웃"
          className="shrink-0 text-gray-900 transition-colors hover:text-gray-600"
        >
          <CircleUserRound className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={1.25} />
        </button>
      ) : (
        <Link
          href="/login"
          className="shrink-0 rounded bg-[#1e1e1e] px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 sm:px-4 sm:text-sm"
        >
          로그인
        </Link>
      )}
    </header>
  );
}
