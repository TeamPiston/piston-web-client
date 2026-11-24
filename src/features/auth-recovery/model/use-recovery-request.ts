"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/shared/api";

function getErrorMessage(error: unknown, reset: boolean) {
  if (error instanceof ApiError) {
    if (error.status === 429) return "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.";
    if (error.kind === "network") return "서버에 연결할 수 없어요. 연결 상태를 확인하고 다시 시도해 주세요.";
    if (reset && error.status === 400) {
      return "코드가 올바르지 않거나 만료되었어요. 코드를 확인하거나 새 코드를 요청해 주세요.";
    }
  }

  return reset
    ? "비밀번호를 재설정하지 못했어요. 잠시 후 다시 시도해 주세요."
    : "메일 요청을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.";
}

export function useRecoveryRequest({ reset = false } = {}) {
  const pending = useRef<AbortController | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => () => pending.current?.abort(), []);

  const submit = async (
    operation: (signal: AbortSignal) => Promise<void>,
    onSuccess: (signal: AbortSignal) => void | Promise<void>,
  ) => {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setError("");
    setIsSubmitting(true);

    try {
      await operation(controller.signal);
      if (!controller.signal.aborted) await onSuccess(controller.signal);
    } catch (error: unknown) {
      if (!controller.signal.aborted) setError(getErrorMessage(error, reset));
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setIsSubmitting(false);
    }
  };

  return { isSubmitting, error, setError, submit };
}
