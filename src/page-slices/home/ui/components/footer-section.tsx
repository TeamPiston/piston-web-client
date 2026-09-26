import Link from "next/link";
import { PistonLogo } from "@/shared/ui";

const footerLinks = [
  { label: "Create", href: "/create" },
  { label: "Feed", href: "/feed" },
  { label: "이용약관", href: "/register" },
  { label: "프린터 관리", href: "/create" },
];

export function FooterSection() {
  return (
    <footer className="border-t border-zinc-100 bg-[#fbfbfb] px-6 py-14 sm:px-10">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1fr_auto]">
        <div>
          <PistonLogo height={22} />
          <p className="mt-4 text-sm font-extrabold text-zinc-900">
            아이디어가 출력이 되는 가장 빠른 방법
          </p>
          <p className="mt-3 max-w-md text-xs font-medium leading-6 text-zinc-500">
            말로 설명하면 AI가 3D 모델을 만들고, 출력 가능한지 검증한 뒤
            연결된 프린터로 바로 출력하는 서비스입니다.
          </p>
        </div>
        <nav className="flex flex-col gap-3 text-xs font-semibold text-zinc-500">
          <p className="mb-1 font-extrabold text-zinc-900">서비스</p>
          {footerLinks.map((link) => (
            <Link key={link.label} href={link.href} className="transition hover:text-zinc-950">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="mx-auto mt-12 max-w-6xl border-t border-zinc-200 pt-8 text-xs font-medium text-zinc-400">
        © 2026 PISTON. All rights reserved.
      </div>
    </footer>
  );
}
