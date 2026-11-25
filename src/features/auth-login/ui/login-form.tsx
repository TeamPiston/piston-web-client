"use client";

import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { isMockModeEnabled, MOCK_LOGIN_CREDENTIALS } from "@/shared/mock/mock-data";
import { Button, TextInput } from "@/shared/ui";
import { DemoNotice } from "@/shared/ui/demo-notice";
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
    isSubmitting,
    handleSubmit,
  } = useLoginForm();

  return (
    <div className="box-border w-full bg-white p-5 sm:p-8">
      <p className="mb-4 text-xs font-medium text-gray-500">아이디로 로그인</p>
      <DemoNotice isVisible={isMockModeEnabled()} className="mb-4">
        <p>데모 계정을 채운 뒤 로그인 버튼을 눌러 주세요. 실제 계정이나 비밀번호는 입력하지 마세요.</p>
        <button
          type="button"
          className="mt-2 min-h-8 rounded-md border border-blue-200 bg-white px-3 font-semibold text-blue-900 hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          onClick={() => {
            setId(MOCK_LOGIN_CREDENTIALS.id);
            setPassword(MOCK_LOGIN_CREDENTIALS.password);
          }}
        >
          데모 계정 채우기
        </button>
      </DemoNotice>
      <form onSubmit={handleSubmit} aria-busy={isSubmitting} className="space-y-3">
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
        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "로그인 중..." : "로그인"}</Button>
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
