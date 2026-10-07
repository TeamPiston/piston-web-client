"use client";

import { CircleUserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore, type MouseEvent } from "react";
import { useAuth } from "@/entities/session";
import { PistonLogo } from "@/shared/ui";
import { LoginRequiredModal } from "./login-required-modal";

const navigationItems = [
  { href: "/create", label: "Create" },
  { href: "/feed", label: "Feed" },
];

const subscribeToMount = () => () => {};
const getClientMountState = () => true;
const getServerMountState = () => false;

export function Header() {
  const pathname = usePathname();
  const { isLoggedIn } = useAuth();
  const isMounted = useSyncExternalStore(
    subscribeToMount,
    getClientMountState,
    getServerMountState,
  );
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const handleNavigation = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isMounted || !isLoggedIn) {
      event.preventDefault();
      setIsLoginModalOpen(true);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-20 grid h-[100px] w-full grid-cols-[1fr_auto] items-center border-b border-gray-200 bg-white/85 px-4 py-4 backdrop-blur-sm sm:grid-cols-3 sm:px-8 lg:px-12">
        <Link
          href="/"
          aria-label="PISTON 메인으로 이동"
          className="col-start-1 row-start-1 justify-self-start"
        >
          <PistonLogo />
        </Link>

        <nav
          aria-label="주 메뉴"
          className="col-span-2 row-start-2 flex w-full max-w-[200px] items-center justify-between justify-self-center text-sm font-medium text-gray-700 sm:col-span-1 sm:col-start-2 sm:row-start-1"
        >
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

        {isMounted && isLoggedIn ? (
          <Link
            href="/mypage"
            aria-label="마이페이지"
            title="마이페이지"
            className="col-start-2 row-start-1 justify-self-end text-[#5a7bff] transition-colors hover:text-[#4a6ee5] sm:col-start-3"
          >
            <CircleUserRound className="h-9 w-9" strokeWidth={1.6} aria-hidden="true" />
          </Link>
        ) : (
          <Link
            href="/login"
            className="col-start-2 row-start-1 justify-self-end rounded-lg bg-[#1e1e1e] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 sm:col-start-3"
          >
            로그인
          </Link>
        )}
      </header>
      <LoginRequiredModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
    </>
  );
}
