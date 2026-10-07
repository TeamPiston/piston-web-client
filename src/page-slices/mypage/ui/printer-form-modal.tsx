"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { Printer } from "@/shared/mock/mock-data";

export type PrinterDraft = Pick<Printer, "name" | "model" | "ipAddress">;

interface PrinterFormModalProps {
  printer: Printer | null;
  onClose: () => void;
  onSave: (draft: PrinterDraft) => void;
  onTestConnection: (draft: PrinterDraft) => string;
}

const PRINTER_MODELS = ["QIDI X-Max 4", "QIDI X-Plus 4", "QIDI Q1 Pro"];
const IP_SEGMENT_PATTERN = "(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])";
const IP_ADDRESS_PATTERN = `${IP_SEGMENT_PATTERN}(?:\\.${IP_SEGMENT_PATTERN}){3}`;
const INPUT_CLASSES =
  "h-[50px] w-full min-w-0 rounded-lg border border-gray-300 bg-transparent px-4 text-base text-gray-950 outline-none focus:border-[#5a7bff] focus:ring-1 focus:ring-[#5a7bff]";

export function PrinterFormModal({
  printer,
  onClose,
  onSave,
  onTestConnection,
}: PrinterFormModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const ipInputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const ipInputId = useId();
  const feedbackId = useId();
  const [draft, setDraft] = useState<PrinterDraft>(() => ({
    name: printer?.name ?? "",
    model: printer?.model ?? PRINTER_MODELS[0],
    ipAddress: printer?.ipAddress ?? "",
  }));
  const [connectionFeedback, setConnectionFeedback] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";

    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus();
      }
    };
  }, []);

  const savePrinter = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave({ ...draft, name: draft.name.trim(), ipAddress: draft.ipAddress.trim() });
  };

  const testConnection = () => {
    if (ipInputRef.current?.reportValidity()) {
      setConnectionFeedback(onTestConnection(draft));
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[560px] overflow-y-auto rounded-[20px] bg-[#fbfbfb] p-6 shadow-2xl backdrop:bg-black/40 sm:p-8"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) {
          return;
        }
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left || event.clientX > bounds.right ||
          event.clientY < bounds.top || event.clientY > bounds.bottom
        ) {
          onClose();
        }
      }}
    >
      <h2 id={titleId} className="text-xl font-bold text-gray-950">
        {printer ? "프린터 수정" : "프린터 추가"}
      </h2>
      <form className="mt-6 flex flex-col gap-5" onSubmit={savePrinter}>
        <label className="flex flex-col gap-2 text-sm font-bold text-gray-950">
          프린터 이름
          <input
            required
            pattern={".*\\S.*"}
            title="프린터 이름을 입력해 주세요."
            maxLength={100}
            value={draft.name}
            onChange={(event) =>
              setDraft((current) => ({ ...current, name: event.target.value }))
            }
            className={`${INPUT_CLASSES} font-normal`}
          />
        </label>
        <label className="flex flex-col gap-2 text-sm font-bold text-gray-950">
          프린터 모델
          <select
            value={draft.model}
            onChange={(event) => {
              setDraft((current) => ({ ...current, model: event.target.value }));
              setConnectionFeedback("");
            }}
            className={`${INPUT_CLASSES} font-normal`}
          >
            {!PRINTER_MODELS.includes(draft.model) && (
              <option value={draft.model}>{draft.model}</option>
            )}
            {PRINTER_MODELS.map((model) => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
        </label>
        <div>
          <label htmlFor={ipInputId} className="text-sm font-bold text-gray-950">
            IP 주소
          </label>
          <div className="mt-2 flex items-center gap-2">
            <input
              ref={ipInputRef}
              id={ipInputId}
              required
              inputMode="decimal"
              pattern={IP_ADDRESS_PATTERN}
              title="올바른 IPv4 주소를 입력해 주세요. 예: 192.168.0.24"
              maxLength={15}
              placeholder="192.168.0.24"
              aria-describedby={connectionFeedback ? feedbackId : undefined}
              value={draft.ipAddress}
              onChange={(event) => {
                setDraft((current) => ({ ...current, ipAddress: event.target.value }));
                setConnectionFeedback("");
              }}
              className={`${INPUT_CLASSES} flex-1`}
            />
            <button
              type="button"
              onClick={testConnection}
              className="h-[46px] w-[106px] shrink-0 rounded-lg border border-gray-300 text-sm font-medium text-gray-950 transition-colors hover:bg-gray-100"
            >
              연결 테스트
            </button>
          </div>
          {connectionFeedback && (
            <p id={feedbackId} role="status" className="mt-2 text-sm leading-5 text-gray-600">
              {connectionFeedback}
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-[58px] rounded-lg border border-gray-300 bg-gray-50 text-base font-medium text-gray-500 transition-colors hover:bg-gray-100"
          >
            취소
          </button>
          <button
            type="submit"
            className="h-[58px] rounded-lg bg-[#5a7bff] text-base font-medium text-white transition-colors hover:bg-[#4a6ee5]"
          >
            저장하기
          </button>
        </div>
      </form>
    </dialog>
  );
}
