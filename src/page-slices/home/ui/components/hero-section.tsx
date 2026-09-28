import Link from "next/link";
import { PistonLogo } from "@/shared/ui";

export function HeroSection() {
  return (
    <section className="relative flex min-h-[620px] items-center justify-center overflow-hidden bg-gradient-to-br from-sky-100 via-white to-teal-50 px-6 py-24 text-center sm:min-h-[720px]">
      <div
        aria-hidden
        className="absolute -left-24 -top-24 h-[30rem] w-[30rem] rounded-full border border-white/60 bg-sky-200/20 blur-[1px]"
      />
      <div
        aria-hidden
        className="absolute bottom-[-10rem] right-[12%] h-[34rem] w-[34rem] rounded-full border border-white/70 bg-teal-100/50 blur-[1px]"
      />
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/30 blur-3xl"
      />

      <div className="relative z-10 flex w-full max-w-4xl flex-col items-center">
        <PistonLogo height={40} />
        <p className="mt-10 text-base font-semibold leading-8 text-zinc-700 sm:text-lg">
          PISTON은 AI 챗봇을 활용하여 자연어로 3D 프린팅을 쉽게 도와주는
          서비스입니다.
          <br className="hidden sm:block" />
          복잡한 3D 프린터 지식 없이 한 문장으로 아이디어를 출력해 보세요.
        </p>
        <Link
          href="/create"
          className="mt-14 inline-flex h-12 items-center justify-center rounded-xl border border-zinc-200 bg-white px-8 text-sm font-semibold text-zinc-800 shadow-sm transition hover:-translate-y-0.5 hover:border-[#5B7FFF] hover:text-[#4b6fff] hover:shadow-md"
        >
          시작하기
        </Link>
      </div>
    </section>
  );
}
