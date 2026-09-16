"use client";

import Link from "next/link";
import { useState } from "react";
import { Check } from "lucide-react";
import { Header } from "@/components/Header";
import { Button, PistonLogo, TextInput } from "@/shared/ui";

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
                    <TextInput
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="가입하신 이메일을 입력해 주세요."
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
                <Button type="submit" disabled={isSubmitted}>
                  이메일 전송
                </Button>
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