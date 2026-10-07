"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import type {
  Printer,
  PrinterConnectionStatus,
  PrinterConnectionTestResult,
} from "@/shared/mock/mock-data";
import { PrinterModalShell } from "./printer-modal-shell";

export type PrinterDraft = Pick<Printer, "name" | "model" | "ipAddress">;

interface PrinterFormModalProps {
  printer: Printer | null;
  onClose: () => void;
  onSave: (draft: PrinterDraft, testedStatus: PrinterConnectionStatus | null) => void;
  onTestConnection: (draft: PrinterDraft) => PrinterConnectionTestResult;
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
  const modelSelectRef = useRef<HTMLSelectElement>(null);
  const ipInputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const ipInputId = useId();
  const feedbackId = useId();
  const [draft, setDraft] = useState<PrinterDraft>(() => ({
    name: printer?.name ?? "",
    model: printer?.model ?? "",
    ipAddress: printer?.ipAddress ?? "",
  }));
  const [connectionFeedback, setConnectionFeedback] =
    useState<PrinterConnectionTestResult | null>(null);
  const isRegistrationBlocked = !printer && connectionFeedback?.status !== "connected";

  const savePrinter = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isRegistrationBlocked) {
      return;
    }

    onSave(
      { ...draft, name: draft.name.trim(), ipAddress: draft.ipAddress.trim() },
      connectionFeedback?.status ?? null,
    );
  };

  const testConnection = () => {
    if (
      modelSelectRef.current?.reportValidity() &&
      ipInputRef.current?.reportValidity()
    ) {
      setConnectionFeedback(onTestConnection(draft));
    }
  };

  return (
    <PrinterModalShell labelledBy={titleId} onClose={onClose}>
      <h2 id={titleId} className="text-xl font-bold text-gray-950">
        {printer ? "프린터 수정" : "프린터 추가"}
      </h2>
      {!printer && (
        <p className="mt-1 text-sm leading-5 text-gray-500">
          프린터와 같은 와이파이에 연결된 상태에서 등록해 주세요.
        </p>
      )}
      <form className="mt-6 flex flex-col gap-5" onSubmit={savePrinter}>
        <label className="flex flex-col gap-2 text-sm font-bold text-gray-950">
          프린터 이름
          <input
            required
            pattern={".*\\S.*"}
            title="프린터 이름을 입력해 주세요."
            maxLength={100}
            placeholder="교실 프린터"
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
            ref={modelSelectRef}
            required
            value={draft.model}
            onChange={(event) => {
              setDraft((current) => ({ ...current, model: event.target.value }));
              setConnectionFeedback(null);
            }}
            className={`${INPUT_CLASSES} font-normal`}
          >
            <option value="" disabled>프린터 모델 선택</option>
            {draft.model && !PRINTER_MODELS.includes(draft.model) && (
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
              placeholder={printer ? "192.168.0.24" : "192.168.0.31"}
              aria-describedby={connectionFeedback ? feedbackId : undefined}
              value={draft.ipAddress}
              onChange={(event) => {
                setDraft((current) => ({ ...current, ipAddress: event.target.value }));
                setConnectionFeedback(null);
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
        </div>
        {connectionFeedback && (
          connectionFeedback.status === "connected" ? (
            <div
              id={feedbackId}
              role="status"
              className="flex gap-3 rounded-xl border border-emerald-400 bg-[#f5f5f5] p-5"
            >
              <span
                aria-hidden="true"
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-400"
              />
              <div className="min-w-0">
                <p className="text-sm font-bold text-emerald-500">프린터를 찾았어요</p>
                <p className="mt-2 text-sm leading-5 text-gray-500">
                  {connectionFeedback.model} · 노즐 {connectionFeedback.nozzleTemperature}°C
                  {" / "}베드 {connectionFeedback.bedTemperature}°C · {connectionFeedback.activity}
                </p>
              </div>
            </div>
          ) : !printer ? (
            <div
              id={feedbackId}
              role="alert"
              className="rounded-xl border border-red-400 bg-[#f5f5f5] p-5"
            >
              <p className="text-sm font-bold text-red-500">프린터를 찾을 수 없어요</p>
              <p className="mt-2 text-sm leading-5 text-gray-500">
                아래를 확인하고 다시 시도해 주세요.
              </p>
              <ul className="mt-2 list-disc space-y-2 pl-4 text-xs leading-5 text-gray-950 marker:text-gray-500">
                <li>프린터와 이 컴퓨터가 같은 와이파이에 연결되어 있는지</li>
                <li>IP 주소를 정확히 입력했는지</li>
                <li>프린터 전원이 켜져 있고 절전 상태가 아닌지</li>
              </ul>
            </div>
          ) : (
            <p id={feedbackId} role="status" className="text-sm leading-5 text-gray-600">
              {connectionFeedback.message}
            </p>
          )
        )}
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
            disabled={isRegistrationBlocked}
            className="h-[58px] rounded-lg bg-[#5a7bff] text-base font-medium text-white transition-colors enabled:hover:bg-[#4a6ee5] disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {printer ? "저장하기" : "등록하기"}
          </button>
        </div>
      </form>
    </PrinterModalShell>
  );
}
