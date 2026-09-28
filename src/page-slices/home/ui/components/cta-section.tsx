import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/entities/session";

export function CTASection() {
  const { isLoggedIn } = useAuth();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => setIsMounted(true));

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const startHref = isMounted && isLoggedIn ? "/create" : "/login";

  return (
    <section className="bg-white px-6 py-24 text-center sm:px-10">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-3xl font-extrabold leading-tight text-zinc-950 sm:text-4xl">
          떠오른 아이디어, 지금 바로 꺼내 보세요
        </h2>
        <p className="mt-5 text-sm font-semibold leading-7 text-zinc-500 sm:text-base">
          가입하고 첫 디자인을 만들어 보세요. 몇 분이면 충분해요.
        </p>
        <Link
          href={startHref}
          className="mt-10 inline-flex h-14 items-center justify-center rounded-xl bg-[#5B7FFF] px-9 text-sm font-extrabold text-white shadow-sm shadow-blue-200 transition hover:-translate-y-0.5 hover:bg-[#4a6ee5] hover:shadow-md"
        >
          프로세스 시작하기
        </Link>
      </div>
    </section>
  );
}
