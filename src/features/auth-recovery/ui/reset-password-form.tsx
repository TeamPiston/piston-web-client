"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/entities/session";
import { Button, TextInput } from "@/shared/ui";
import { isMockModeEnabled } from "@/shared/mock/mock-data";
import { resetPassword } from "../api/recovery";
import { useRecoveryRequest } from "../model/use-recovery-request";

const MIN_PASSWORD_LENGTH = 8;

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mock = isMockModeEnabled();
  const { prepareLocalSignOut } = useAuth();
  const [token, setToken] = useState(() => {
    const codes = searchParams.getAll("token");
    return codes.length === 1 ? codes[0] : "";
  });
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const { error, setError, isSubmitting, submit } = useRecoveryRequest({ reset: true });

  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("token")) return;
    url.searchParams.delete("token");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mock || isSubmitting || isComplete) return;

    const code = token.trim();
    if (!code) {
      setError("메일로 받은 재설정 코드를 입력해 주세요.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError("새 비밀번호를 8자 이상 입력해 주세요.");
      return;
    }
    if (password !== confirmation) {
      setError("새 비밀번호와 확인 입력이 일치하지 않아요.");
      return;
    }

    const signOutCurrentSession = prepareLocalSignOut();
    void submit((signal) => resetPassword(code, password, signal), async (signal) => {
      setToken("");
      setPassword("");
      setConfirmation("");
      setIsComplete(true);
      await signOutCurrentSession(() => {
        if (!signal.aborted) router.replace("/login");
      });
    });
  };

  return (
    <div className="box-border w-full bg-white p-5 sm:p-8">
      <h1 className="mb-3 text-base font-semibold text-gray-900">비밀번호 재설정</h1>
      {mock && <p role="status" className="mb-3 text-sm text-gray-600">데모에서는 비밀번호를 변경할 수 없어요.</p>}

      {isComplete && <p role="status" className="mb-3 text-sm text-gray-700">비밀번호를 변경했어요.</p>}

      <form method="post" onSubmit={handleSubmit} aria-busy={isSubmitting} className="space-y-3">
        <div className="space-y-1">
          <label htmlFor="reset-code" className="text-sm text-gray-700">재설정 코드</label>
          <TextInput id="reset-code" type="password" autoComplete="one-time-code" spellCheck={false}
            value={token} onChange={(event) => setToken(event.target.value)} disabled={mock || isSubmitting || isComplete} required />
        </div>
        <div className="space-y-1">
          <label htmlFor="new-password" className="text-sm text-gray-700">새 비밀번호</label>
          <TextInput id="new-password" type="password" autoComplete="new-password"
            value={password} onChange={(event) => setPassword(event.target.value)} minLength={MIN_PASSWORD_LENGTH}
            placeholder="8자 이상" disabled={mock || isSubmitting || isComplete} required />
        </div>
        <div className="space-y-1">
          <label htmlFor="confirm-password" className="text-sm text-gray-700">새 비밀번호 확인</label>
          <TextInput id="confirm-password" type="password" autoComplete="new-password"
            value={confirmation} onChange={(event) => setConfirmation(event.target.value)}
            disabled={mock || isSubmitting || isComplete} required />
        </div>
        {error && <p role="alert" className="text-xs font-medium text-red-600">{error}</p>}
        <Button type="submit" disabled={mock || isSubmitting || isComplete}>
          {isSubmitting ? "변경 중..." : "비밀번호 변경"}
        </Button>
      </form>

      <div className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs font-medium text-gray-600">
        <Link href="/find-pwd" className="hover:text-gray-900">새 코드 요청</Link>
        <Link href="/login" className="hover:text-gray-900">로그인</Link>
      </div>
    </div>
  );
}
