"use client";

import { useEffect, useRef, useState } from "react";
import { AccountDeletionSessionChangedError } from "@/entities/session";

interface DeleteAccountModalProps {
  isOpen: boolean;
  blockedMessage?: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteAccountModal({ isOpen, blockedMessage, onClose, onConfirm }: DeleteAccountModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitting = useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) {
        setErrorMessage(null);
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleClose = () => {
    if (submitting.current) {
      return;
    }

    setErrorMessage(null);
    onClose();
  };

  const handleConfirm = async () => {
    if (submitting.current || blockedMessage) {
      return;
    }

    submitting.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await onConfirm();
    } catch (error) {
      setErrorMessage(error instanceof AccountDeletionSessionChangedError
        ? error.message
        : "회원탈퇴 결과를 확인할 수 없습니다. 계정 상태를 확인해 주세요.");
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
    >
      <section
        aria-describedby="delete-account-description"
        aria-labelledby="delete-account-title"
        aria-modal="true"
        className="w-full max-w-[440px] rounded-2xl bg-white px-7 py-8 shadow-2xl"
        role="dialog"
      >
        <div className="text-center">
          <h2 id="delete-account-title" className="text-base font-bold text-gray-950">
            정말 탈퇴하시겠어요?
          </h2>
          <p
            id="delete-account-description"
            className="mt-3 text-xs leading-5 text-gray-500"
          >
            탈퇴하면 계정과 함께 아래 내용이 모두 삭제되며
            <br />
            되돌릴 수 없어요.
          </p>
        </div>

        <ul className="my-4 list-[square] space-y-1 rounded-xl bg-gray-50 p-4 pl-8 text-xs text-gray-700">
          <li>생성한 3D 디자인과 대화 기록</li>
          <li>출력 기록과 진행 중인 출력</li>
          <li>피드에 공유한 게시물</li>
        </ul>

        {(blockedMessage || errorMessage) && (
          <p className="mb-4 text-center text-xs leading-5 text-red-500" role="alert">
            {blockedMessage ?? errorMessage}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="h-[58px] rounded-lg border border-gray-300 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={isSubmitting || !!blockedMessage}
            className="h-[58px] rounded-lg bg-red-500 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "탈퇴 처리 중..." : "탈퇴하기"}
          </button>
        </div>
      </section>
    </div>
  );
}
