"use client";

import Link from "next/link";
import { useState } from "react";
import { Check } from "lucide-react";
import { Header } from "@/components/Header"; 
import { PistonLogo } from "@/components/PistonLogo";

export default function FindIdPage() {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (email.trim()) {
      console.log({ email });
      setIsSubmitted(true);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col overflow-hidden">
      <div className="relative z-10 flex min-h-screen w-full flex-col">
        <Header />
        <main className="flex-1 flex flex-col items-center justify-center px-4 pb-24">
          <div className="w-full max-w-[500px] flex flex-col items-center">
            <PistonLogo className="pb-4" />
            <div className="w-full bg-white p-8">
              <p className="text-xs text-gray-500 mb-2 font-medium">비밀번호 찾기</p>
              
              <form onSubmit={handleSubmit} className="space-y-1">
                
                {!isSubmitted ? (
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="가입하신 이메일을 입력해 주세요."
                      className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-white/80 placeholder-gray-400 text-sm focus:outline-none focus:border-[#5B7FFF] focus:ring-1 focus:ring-[#5B7FFF] transition-all"
                      required
                    />
                  </div>
                ) : (
                  <div className="w-full h-12 px-4 rounded-xl bg-gray-100/80 border border-gray-200 flex items-center justify-between text-sm text-gray-700 animate-fadeIn">
                    <span>입력하신 이메일로 비밀번호가 전송되었습니다.</span>
                    <Check size={18} className="text-teal-500 stroke-[2.5]" />
                  </div>
                )}

                {/* 이메일 전송 버튼 */}
                <button
                  type="submit"
                  disabled={isSubmitted}
                  className="w-full h-12 bg-[#5B7FFF] text-white font-semibold rounded-xl text-sm hover:bg-[#4a6ee5] active:scale-[0.99] disabled:bg-[#8da6ff] disabled:scale-100 disabled:cursor-not-allowed transition-all mt-2 shadow-sm shadow-blue-200"
                >
                  이메일 전송
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