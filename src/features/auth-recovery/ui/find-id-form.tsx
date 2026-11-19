"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { Button, TextInput } from "@/shared/ui";
import { useFindIdForm } from "../model/use-find-id-form";

export function FindIdForm() {
  const { email, setEmail, isSubmitted, handleSubmit } = useFindIdForm();

  return (
    <div className="box-border w-full bg-white p-5 sm:p-8">
      <p className="mb-2 text-xs font-medium text-gray-500">아이디 찾기</p>

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
          <div className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-100/80 px-4 py-2 text-sm text-gray-700 animate-fadeIn">
            <span className="min-w-0">입력하신 이메일로 아이디가 전송되었습니다.</span>
            <Check size={18} className="text-teal-500 stroke-[2.5]" />
          </div>
        )}

        {/* 이메일 전송 버튼 */}
        <Button type="submit" disabled={isSubmitted}>
          이메일 전송
        </Button>
      </form>

      {/* 하단 부가 링크 */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] font-medium text-gray-500">
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
