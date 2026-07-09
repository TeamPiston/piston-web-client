"use client";

import Link from "next/link";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Header } from "@/components/Header"; 
import { PistonLogo } from "@/components/PistonLogo";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log({ id, password });
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col overflow-hidden">
      <div className="relative z-10 flex min-h-screen w-full flex-col">
        <Header />
        <main className="flex-1 flex flex-col items-center justify-center px-4 pb-24">
          <div className="w-full max-w-[500px] flex flex-col items-center">
            <PistonLogo className="pb-4" />
            <div className="w-full bg-white p-8">
              <p className="text-xs text-gray-500 mb-4 font-medium">아이디로 로그인</p>
              <form onSubmit={handleSubmit} className="space-y-3">
                {/* 아이디 */}
                <div className="relative">
                  <input
                    type="text"
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    placeholder="아이디를 입력해 주세요."
                    className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-white/80 placeholder-gray-400 text-sm focus:outline-none focus:border-[#5B7FFF] focus:ring-1 focus:ring-[#5B7FFF] transition-all"
                  />
                </div>

                {/* 비밀번호 */}
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="비밀번호를 입력해 주세요."
                    className="w-full h-12 px-4 pr-12 rounded-xl border border-gray-200 bg-white/80 placeholder-gray-400 text-sm focus:outline-none focus:border-[#5B7FFF] focus:ring-1 focus:ring-[#5B7FFF] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                </div>

                {/* 로그인 버튼 */}
                <button
                  type="submit"
                  className="w-full h-12 bg-[#5B7FFF] text-white font-semibold rounded-xl text-sm hover:bg-[#4a6ee5] active:scale-[0.99] transition-all mt-2 shadow-sm shadow-blue-200"
                >
                  로그인
                </button>
              </form>

            {/* 하단 부가 링크 */}
            <div className="flex items-center justify-center gap-4 mt-6 text-[11px] text-gray-500 font-medium">
              <Link href="/find-id" className="hover:text-gray-800 transition-colors">
                아이디 찾기
              </Link>
              <span className="w-[1px] h-3 bg-gray-200" />
              <Link href="/find-pwd" className="hover:text-gray-800 transition-colors">
                비밀번호 찾기
              </Link>
              <span className="w-[1px] h-3 bg-gray-200" />
              <Link href="/register" className="hover:text-gray-800 transition-colors">
                회원가입
              </Link>
            </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}