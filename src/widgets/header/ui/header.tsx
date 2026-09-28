"use client";

import { CircleUserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/entities/session";
import { PistonLogo } from "@/shared/ui";

const navigationItems = [
  { href: "/create", label: "Create" },
  { href: "/feed", label: "Feed" },
];

export function Header() {
  const pathname = usePathname();
  const { isLoggedIn, logout } = useAuth();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => setIsMounted(true));

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  return (
    <header className="sticky top-0 z-20 grid w-full grid-cols-3 items-center bg-white/85 px-12 py-4 backdrop-blur-sm">
      <span className="justify-self-start">
        <PistonLogo />
      </span>

      <nav className="flex w-full max-w-[200px] items-center justify-between justify-self-center text-sm font-medium text-gray-700">
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

      {isMounted && isLoggedIn ? (
        <button
          type="button"
          onClick={logout}
          aria-label="로그아웃"
          title="로그아웃"
          className="justify-self-end text-gray-900 transition-colors hover:text-gray-600"
        >
          <CircleUserRound className="h-8 w-8" strokeWidth={1.25} />
        </button>
      ) : (
        <Link
          href="/login"
          className="justify-self-end rounded bg-[#1e1e1e] px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          로그인
        </Link>
      )}
    </header>
  );
}
