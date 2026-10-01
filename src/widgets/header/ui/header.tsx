"use client";

import { CircleUserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type MouseEvent } from "react";
import { useAuth } from "@/entities/session";
import { PistonLogo } from "@/shared/ui";
import { LoginRequiredModal } from "./login-required-modal";

const navigationItems = [
  { href: "/create", label: "Create" },
  { href: "/feed", label: "Feed" },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoggedIn } = useAuth();
  const [isMounted, setIsMounted] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => setIsMounted(true));

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const handleNavigation = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isMounted || !isLoggedIn) {
      event.preventDefault();
      setIsLoginModalOpen(true);
    }
  };

  const handleProfileNavigation = () => {
    if (!isMounted || !isLoggedIn) {
      setIsLoginModalOpen(true);
      return;
    }

    router.push("/mypage");
  };

  return (
    <>
      <header className="sticky top-0 z-20 grid h-[100px] w-full grid-cols-3 items-center border-b border-gray-200 bg-white/85 px-12 py-4 backdrop-blur-sm">
        <Link
          href="/"
          aria-label="PISTON 메인으로 이동"
          className="cursor-pointer justify-self-start"
        >
          <PistonLogo />
        </Link>

        <nav className="flex w-full max-w-[200px] items-center justify-between justify-self-center text-sm font-medium text-gray-700">
          {navigationItems.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleNavigation}
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

        <div className="flex items-center gap-3 justify-self-end">
          {!isMounted || !isLoggedIn ? (
            <Link
              href="/login"
              className="rounded bg-[#1e1e1e] px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              로그인
            </Link>
          ) : null}
          <button
            type="button"
            onClick={handleProfileNavigation}
            aria-label="마이페이지 이동"
            title="마이페이지"
            className="cursor-pointer text-gray-900 transition-colors hover:text-gray-600"
          >
            <CircleUserRound className="h-8 w-8" strokeWidth={1.25} />
          </button>
        </div>
      </header>
      <LoginRequiredModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
    </>
  );
}
