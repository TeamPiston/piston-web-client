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
    error,
    handleSubmit,
  } = useLoginForm();

  return (
    <div className="box-border w-full bg-white p-5 sm:p-8">
      <p className="mb-4 text-xs font-medium text-gray-500">아이디로 로그인</p>
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

        {error && (
          <p role="alert" className="pt-1 text-xs font-medium text-red-500">
            {error}
          </p>
        )}

        {/* 로그인 버튼 */}
        <Button type="submit">로그인</Button>
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
