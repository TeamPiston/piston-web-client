"use client";

import type { CopyrightWarning, PrintCorrection, PrintWarning } from "../../model/types";

export function AiLoadingCard() {
  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] rounded-2xl border border-gray-200 bg-white p-4 text-gray-950">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex items-center gap-1 text-[#5a7bff]" aria-hidden="true">
            <span className="animate-bounce">●</span>
            <span className="animate-bounce [animation-delay:-0.15s]">●</span>
            <span className="animate-bounce [animation-delay:-0.3s]">●</span>
          </span>
          3D 모델을 생성하고 있어요
        </div>
        <p className="mt-2 text-xs text-gray-400">보통 20~40초 정도 걸려요</p>
      </div>
    </div>
  );
}

interface PrintWarningCardProps {
  isDisabled: boolean;
  onAutoFix: () => void;
  warning: PrintWarning;
}

export function PrintWarningCard({ isDisabled, onAutoFix, warning }: PrintWarningCardProps) {
  return (
    <div className="max-w-[92%] rounded-2xl border border-red-400 bg-white p-4 text-gray-950">
      <div className="flex items-center gap-2 text-sm font-semibold text-red-500">
        <span aria-hidden="true" className="text-base leading-none">
          ●
        </span>
        {warning.title}
      </div>
      <p className="mt-4 text-xs leading-5 text-gray-500">{warning.description}</p>
      <div className="mt-3 rounded-xl bg-gray-50 px-4 py-3">
        {warning.issues.map((issue, index) => (
          <div
            key={issue.label}
            className={index < warning.issues.length - 1 ? "mb-3" : ""}
          >
            <p className="text-xs text-gray-500">{issue.label}</p>
            <p className="mt-1 text-sm font-semibold text-gray-950">
              {issue.current}
              <span className="px-2 text-gray-400">→</span>
              {issue.required}
            </p>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onAutoFix}
        disabled={isDisabled}
        className="mt-3 h-11 w-full rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-950 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
      >
        규격에 맞게 자동 수정
      </button>
    </div>
  );
}

interface PrintCorrectionCardProps {
  correction: PrintCorrection;
}

export function PrintCorrectionCard({ correction }: PrintCorrectionCardProps) {
  return (
    <div className="max-w-[92%] rounded-2xl border border-gray-200 bg-white p-4 text-gray-950">
      <div className="flex items-center gap-2 text-sm font-semibold text-emerald-500">
        <span aria-hidden="true" className="text-base leading-none">
          ●
        </span>
        {correction.title}
      </div>
      <div className="mt-4 rounded-xl bg-gray-50 px-4 py-3">
        {correction.issues.map((issue, index) => (
          <div
            key={issue.label}
            className={index < correction.issues.length - 1 ? "mb-3" : ""}
          >
            <p className="text-xs text-gray-500">{issue.label}</p>
            <p className="mt-1 text-sm font-semibold text-gray-950">
              {issue.current}
              <span className="px-2 text-gray-400">→</span>
              {issue.corrected}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

interface CopyrightWarningCardProps {
  warning: CopyrightWarning;
}

export function CopyrightWarningCard({ warning }: CopyrightWarningCardProps) {
  return (
    <div className="max-w-[92%] rounded-2xl border border-gray-200 bg-white p-4 text-gray-950">
      <div className="flex items-center gap-2 text-sm font-semibold text-amber-500">
        <span aria-hidden="true" className="text-base leading-none">
          ●
        </span>
        {warning.title}
      </div>
      <p className="mt-4 text-xs leading-5 text-gray-500">{warning.description}</p>
    </div>
  );
}
