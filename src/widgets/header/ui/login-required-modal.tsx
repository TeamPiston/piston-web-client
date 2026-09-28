"use client";

import { X } from "lucide-react";
import Link from "next/link";

interface LoginRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LoginRequiredModal({ isOpen, onClose }: LoginRequiredModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        aria-labelledby="login-required-title"
        aria-modal="true"
        className="relative w-full max-w-[420px] rounded-2xl bg-white px-7 py-8 shadow-2xl"
        role="dialog"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="로그인 안내 닫기"
          title="닫기"
          className="absolute right-5 top-5 text-gray-400 transition-colors hover:text-gray-700"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        <div className="text-center">
          <h2 id="login-required-title" className="text-base font-bold text-gray-950">
            로그인 후 이용해 주세요
          </h2>
          <p className="mt-4 text-sm text-gray-400">
            Create와 Feed는 로그인 후 이용할 수 있어요.
          </p>
        </div>

        <Link
          href="/login"
          className="mt-9 flex h-14 w-full items-center justify-center rounded-lg bg-indigo-500 text-sm font-semibold text-white transition-colors hover:bg-indigo-600"
        >
          로그인
        </Link>
      </section>
    </div>
  );
}
