"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button, TextInput } from "@/shared/ui";
import { isMockModeEnabled } from "@/shared/mock/mock-data";
import { findId, findPassword } from "../api/recovery";
import { useRecoveryRequest } from "../model/use-recovery-request";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;

export function RecoveryEmailForm({ kind }: { kind: "id" | "password" }) {
  const password = kind === "password";
  const mock = isMockModeEnabled();
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { error, setError, isSubmitting, submit } = useRecoveryRequest();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting || isSubmitted) return;

    const address = email.trim();
    if (!EMAIL_PATTERN.test(address)) {
      setError("이메일 주소를 올바르게 입력해 주세요.");
      return;
    }
    if (mock) {
      setError("");
      setIsSubmitted(true);
      return;
    }
    const request = password ? findPassword : findId;
    void submit((signal) => request(address, signal), () => setIsSubmitted(true));
  };

  return (
    <div className="box-border w-full bg-white p-5 sm:p-8">
      <h1 className="mb-2 text-xs font-medium text-gray-500">{password ? "비밀번호 찾기" : "아이디 찾기"}</h1>
      {password && !isSubmitted && (
        <p className="mb-3 text-xs text-gray-600">메일로 받은 코드로 새 비밀번호를 설정할 수 있어요.</p>
      )}

      <form method="post" onSubmit={handleSubmit} aria-busy={isSubmitting} className="space-y-1">
        {isSubmitted ? (
          <div role="status" className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-100/80 px-4 py-2 text-sm text-gray-700 animate-fadeIn motion-reduce:animate-none">
            <div className="min-w-0">
              <p>{mock
                ? "데모에서 메일 요청을 완료했어요. 실제 메일은 발송되지 않아요."
                : password
                  ? "해당 이메일로 가입된 계정이 있으면 비밀번호 재설정 코드를 보내드렸어요."
                  : "해당 이메일로 가입된 계정이 있으면 아이디 안내 메일을 보내드렸어요."}</p>
              {password && !mock && <p className="mt-1 text-xs">코드는 30분 동안 유효해요.</p>}
            </div>
            <Check aria-hidden="true" size={18} className="text-teal-500 stroke-[2.5]" />
          </div>
        ) : (
          <div className="relative">
            <label htmlFor="recovery-email" className="sr-only">이메일</label>
            <TextInput
              id="recovery-email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="가입하신 이메일을 입력해 주세요."
              disabled={isSubmitting}
              required
            />
          </div>
        )}
        {error && <p role="alert" className="pt-1 text-xs font-medium text-red-600">{error}</p>}
        <Button type="submit" disabled={isSubmitting || isSubmitted}>
          {isSubmitting ? "요청 중..." : "이메일 전송"}
        </Button>
      </form>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] font-medium text-gray-500">
        <Link href="/find-id" className="hover:text-gray-800 transition-colors">아이디 찾기</Link>
        <span aria-hidden="true" className="w-[1px] h-3 bg-gray-200" />
        <Link href="/find-pwd" className="hover:text-gray-800 transition-colors">비밀번호 찾기</Link>
        <span aria-hidden="true" className="w-[1px] h-3 bg-gray-200" />
        <Link href="/register" className="hover:text-gray-800 transition-colors">회원가입</Link>
        {password && (
          <>
            <span aria-hidden="true" className="w-[1px] h-3 bg-gray-200" />
            <Link href="/reset-password" className="hover:text-gray-800 transition-colors">재설정 코드 입력</Link>
          </>
        )}
      </div>
    </div>
  );
}
