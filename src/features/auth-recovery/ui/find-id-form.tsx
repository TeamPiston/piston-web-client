"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { Button, TextInput } from "@/shared/ui";
import { useFindIdForm } from "../model/use-find-id-form";

export function FindIdForm() {
  const { email, setEmail, isSubmitted, handleSubmit } = useFindIdForm();

  return (
    <div className="w-full bg-white p-8">
      <p className="text-xs text-gray-500 mb-2 font-medium">아이디 찾기</p>

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
            <span>입력하신 이메일로 아이디가 전송되었습니다.</span>
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
  );
}
