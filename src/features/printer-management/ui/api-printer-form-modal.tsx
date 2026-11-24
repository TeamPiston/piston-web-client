"use client";

import { useId, useState, type FormEvent } from "react";
import { PRINTER_TYPES, type RegisteredPrinter } from "@/entities/printer";
import { acceptsApiKey, createPrinterDraft, type RegisteredPrinterDraft } from "../model/registered-printer-draft";
import { PrinterModalShell } from "./printer-modal-shell";

const INPUT_CLASSES =
  "h-[50px] w-full min-w-0 rounded-lg border border-gray-300 bg-transparent px-4 text-base text-gray-950 outline-none focus:border-[#5a7bff] focus:ring-1 focus:ring-[#5a7bff]";
const LABEL_CLASSES = "flex flex-col gap-2 text-sm font-bold text-gray-950";

function CredentialField({ label, configured, editable, value, remove, onChange, onRemove }: {
  label: string;
  configured: boolean;
  editable: boolean;
  value: string;
  remove: boolean;
  onChange: (value: string) => void;
  onRemove: (value: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {editable && (
        <label className={LABEL_CLASSES}>
          {label}
          <input
            className={`${INPUT_CLASSES} font-normal`}
            type="password"
            autoComplete="new-password"
            spellCheck={false}
            disabled={remove}
            placeholder={configured ? "설정됨 · 바꾸려면 새로 입력" : "선택 입력"}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        </label>
      )}
      {configured && (
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={remove} onChange={(event) => onRemove(event.target.checked)} />
          기존 {label} 삭제
        </label>
      )}
    </div>
  );
}

export function ApiPrinterFormModal({ printer, busy, error, onClose, onSave }: {
  printer: RegisteredPrinter | null;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (draft: RegisteredPrinterDraft) => void;
}) {
  const titleId = useId();
  const [draft, setDraft] = useState(() => createPrinterDraft(printer));
  const set = <K extends keyof RegisteredPrinterDraft>(key: K, value: RegisteredPrinterDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const editApiKey = acceptsApiKey(draft.type);
  const editBambu = draft.type === "bambu";
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!busy) onSave(draft);
  };

  return (
    <PrinterModalShell labelledBy={titleId} onClose={onClose}>
      <h2 id={titleId} className="text-xl font-bold text-gray-950">{printer ? "프린터 수정" : "프린터 추가"}</h2>
      <p className="mt-1 text-sm leading-5 text-gray-500">프린터 등록은 연결을 확인하거나 출력을 시작하지 않아요.</p>
      <form method="post" className="mt-6 flex flex-col gap-5" onSubmit={handleSubmit} aria-busy={busy}>
        <fieldset disabled={busy} className="contents">
          <label className={LABEL_CLASSES}>
            프린터 이름
            <input
              required pattern={".*\\S.*"} maxLength={100} placeholder="교실 프린터"
              value={draft.name} onChange={(event) => set("name", event.target.value)}
              className={`${INPUT_CLASSES} font-normal`}
            />
          </label>
          <label className={LABEL_CLASSES}>
            프린터 종류
            <select
              required value={draft.type}
              onChange={(event) => {
                const type = event.target.value;
                setDraft((current) => ({ ...current, type, apiKey: "", accessCode: "" }));
              }}
              className={`${INPUT_CLASSES} font-normal`}
            >
              <option value="" disabled>프린터 종류 선택</option>
              {PRINTER_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
          <label className={LABEL_CLASSES}>
            프린터 URL
            <input
              required type="url" maxLength={500} placeholder="http://192.0.2.24:7125"
              value={draft.url} onChange={(event) => set("url", event.target.value)}
              className={`${INPUT_CLASSES} font-normal`}
            />
          </label>
          {editBambu && (
            <label className={LABEL_CLASSES}>
              시리얼 번호
              <input
                className={`${INPUT_CLASSES} font-normal`} value={draft.serialNumber}
                onChange={(event) => set("serialNumber", event.target.value)} placeholder="선택 입력"
              />
            </label>
          )}
          {(editApiKey || printer?.hasApiKey) && (
            <CredentialField label="API 키" configured={!!printer?.hasApiKey} editable={editApiKey}
              value={draft.apiKey} remove={draft.removeApiKey} onChange={(value) => set("apiKey", value)}
              onRemove={(value) => set("removeApiKey", value)}
            />
          )}
          {(editBambu || printer?.hasAccessCode) && (
            <CredentialField label="접근 코드" configured={!!printer?.hasAccessCode} editable={editBambu}
              value={draft.accessCode} remove={draft.removeAccessCode} onChange={(value) => set("accessCode", value)}
              onRemove={(value) => set("removeAccessCode", value)}
            />
          )}
        </fieldset>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button" onClick={onClose} disabled={busy}
            className="h-[58px] rounded-lg border border-gray-300 bg-gray-50 text-base font-medium text-gray-500 transition-colors hover:bg-gray-100"
          >
            취소
          </button>
          <button
            type="submit" disabled={busy}
            className="h-[58px] rounded-lg bg-[#5a7bff] text-base font-medium text-white transition-colors enabled:hover:bg-[#4a6ee5] disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {busy ? "처리 중…" : printer ? "저장하기" : "등록하기"}
          </button>
        </div>
      </form>
    </PrinterModalShell>
  );
}
