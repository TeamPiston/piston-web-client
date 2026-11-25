"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/entities/session";
import { ApiError } from "@/shared/api";
import { isMockModeEnabled, MOCK_LOGIN_CREDENTIALS, MOCK_USER_PROFILE } from "@/shared/mock/mock-data";

const INVALID_CREDENTIALS = "아이디 또는 비밀번호가 올바르지 않습니다.";

export function useLoginForm() {
  const router = useRouter();
  const { login, loginWithCredentials } = useAuth();
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pending = useRef<AbortController | null>(null);

  useEffect(() => () => pending.current?.abort(), []);

  const togglePasswordVisibility = () => setShowPassword((previous) => !previous);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending.current) return;
    const loginId = id.trim();

    if (isMockModeEnabled()) {
      const mockId = loginId.toLowerCase();
      if ((mockId !== MOCK_LOGIN_CREDENTIALS.id && mockId !== "admin@example.com") ||
        password !== MOCK_LOGIN_CREDENTIALS.password) {
        setError(INVALID_CREDENTIALS);
        return;
      }
      login(MOCK_USER_PROFILE);
      router.push("/feed");
      return;
    }

    if (!loginId || !password) {
      setError(INVALID_CREDENTIALS);
      return;
    }

    const controller = new AbortController();
    pending.current = controller;
    setIsSubmitting(true);
    setError("");
    try {
      if (await loginWithCredentials({ id: loginId, password }, controller.signal)) {
        if (!controller.signal.aborted) router.push("/feed");
      }
    } catch (failure) {
      if (!controller.signal.aborted) {
        setError(failure instanceof ApiError && failure.status === 401
          ? INVALID_CREDENTIALS
          : "로그인을 완료할 수 없습니다. 연결 상태를 확인하고 다시 시도해 주세요.");
      }
    } finally {
      if (pending.current === controller) pending.current = null;
      if (!controller.signal.aborted) setIsSubmitting(false);
    }
  };

  return {
    id, setId, password, setPassword, showPassword, togglePasswordVisibility,
    error, isSubmitting, handleSubmit,
  };
}
