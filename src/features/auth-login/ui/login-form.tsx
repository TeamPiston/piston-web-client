"use client";

import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { Button, TextInput } from "@/shared/ui";
import { useLoginForm } from "../model/use-login-form";

export function LoginForm() {
  const {
    id,
    setId,
    password,
    setPassword,
    showPassword,
    togglePasswordVisibility,
    handleSubmit,
  } = useLoginForm();

  return (
    <div className="w-full bg-white p-8">
      <p className="text-xs text-gray-500 mb-4 font-medium">아이디로 로그인</p>
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* 아이디 */}
        <div className="relative">
          <TextInput
            type="text"
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="아이디를 입력해 주세요."
          />
        </div>

        {/* 비밀번호 */}
        <div className="relative">
          <TextInput
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호를 입력해 주세요."
            className="pr-12"
          />
          <button
            type="button"
            onClick={togglePasswordVisibility}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>
        </div>

        {/* 로그인 버튼 */}
        <Button type="submit">로그인</Button>
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
