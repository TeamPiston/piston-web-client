"use client";

import { useState, type FormEvent } from "react";
import {
  getPrintersWithFallback,
  type Printer,
} from "@/shared/mock/mock-data";

interface PrinterDraft {
  name: string;
  model: string;
  ipAddress: string;
}

const EMPTY_DRAFT: PrinterDraft = {
  name: "",
  model: "QIDI X-Max 4",
  ipAddress: "",
};

const PRINTER_MODELS = ["QIDI X-Max 4", "QIDI X-Plus 4", "QIDI Q1 Pro"];

export function PrinterManagementPage() {
  const [printers, setPrinters] = useState<Printer[]>(() =>
    getPrintersWithFallback(),
  );
  const [draft, setDraft] = useState<PrinterDraft>(EMPTY_DRAFT);
  const [editingPrinterId, setEditingPrinterId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const openAddForm = () => {
    setEditingPrinterId(null);
    setDraft(EMPTY_DRAFT);
    setIsFormOpen(true);
  };

  const openEditForm = (printer: Printer) => {
    setEditingPrinterId(printer.id);
    setDraft({
      name: printer.name,
      model: printer.model,
      ipAddress: printer.ipAddress,
    });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingPrinterId(null);
  };

  const savePrinter = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextPrinter = {
      name: draft.name.trim(),
      model: draft.model,
      ipAddress: draft.ipAddress.trim(),
    };

    if (editingPrinterId) {
      setPrinters((currentPrinters) =>
        currentPrinters.map((printer) =>
          printer.id === editingPrinterId
            ? { ...printer, ...nextPrinter }
            : printer,
        ),
      );
      setAnnouncement(`${nextPrinter.name} 프린터 정보를 수정했습니다.`);
    } else {
      setPrinters((currentPrinters) => [
        ...currentPrinters,
        {
          id: `printer-${Date.now()}`,
          ...nextPrinter,
          connectionStatus: "disconnected",
        },
      ]);
      setAnnouncement(`${nextPrinter.name} 프린터를 추가했습니다.`);
    }

    closeForm();
  };

  const deletePrinter = (printer: Printer) => {
    if (!window.confirm(`${printer.name} 프린터를 삭제할까요?`)) {
      return;
    }

    setPrinters((currentPrinters) =>
      currentPrinters.filter((currentPrinter) => currentPrinter.id !== printer.id),
    );
    setAnnouncement(`${printer.name} 프린터를 삭제했습니다.`);
  };

  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col px-4 py-10 sm:px-8 lg:px-0">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-gray-950">프린터 관리</h1>
        <button
          type="button"
          onClick={openAddForm}
          className="h-10 shrink-0 rounded-md bg-[#5a7bff] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#4a6ee5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5a7bff]"
        >
          프린터 추가
        </button>
      </div>

      <section aria-label="등록된 프린터" className="mt-8 flex flex-col gap-4">
        {printers.map((printer) => (
          <article
            key={printer.id}
            className={[
              "flex flex-col gap-5 rounded-2xl border bg-white p-5 sm:flex-row sm:items-center sm:p-6",
              printer.connectionStatus === "connected"
                ? "border-[#5a7bff]"
                : "border-gray-300",
            ].join(" ")}
          >
            <div className="flex min-w-0 flex-1 items-center gap-5">
              <div
                className="h-[72px] w-[72px] shrink-0 rounded-xl bg-[#f5f5f5]"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-bold text-gray-950">
                    {printer.name}
                  </h2>
                  <span
                    className={[
                      "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
                      printer.connectionStatus === "connected"
                        ? "bg-emerald-50 text-emerald-500"
                        : "bg-gray-100 text-gray-500",
                    ].join(" ")}
                  >
                    <span aria-hidden="true">●</span>
                    {printer.connectionStatus === "connected"
                      ? "연결됨"
                      : "연결 끊김"}
                  </span>
                </div>
                <p className="mt-2 break-words text-sm text-gray-500">
                  {printer.model} · {printer.ipAddress}
                </p>
              </div>
            </div>

            <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0">
              <button
                type="button"
                onClick={() =>
                  setAnnouncement(
                    `${printer.name} 프린터는 ${printer.connectionStatus === "connected" ? "연결됨" : "연결 끊김"} 상태입니다.`,
                  )
                }
                className="h-10 flex-1 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 sm:flex-none"
              >
                연결 확인
              </button>
              <button
                type="button"
                onClick={() => openEditForm(printer)}
                className="h-10 flex-1 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 sm:flex-none"
              >
                수정
              </button>
              <button
                type="button"
                onClick={() => deletePrinter(printer)}
                className="h-10 flex-1 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 sm:flex-none"
              >
                삭제
              </button>
            </div>
          </article>
        ))}
        {printers.length === 0 && (
          <p className="rounded-xl border border-dashed border-gray-300 px-5 py-8 text-center text-sm text-gray-500">
            등록된 프린터가 없습니다. 프린터를 추가해 주세요.
          </p>
        )}
      </section>

      {announcement && (
        <p className="mt-4 text-sm text-gray-600" role="status" aria-live="polite">
          {announcement}
        </p>
      )}

      <section className="mt-8 rounded-2xl border border-gray-300 bg-white p-6 sm:p-8">
        <h2 className="text-base font-bold text-gray-950">
          연결하기 전에 확인해 주세요
        </h2>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          PISTON은 무선으로만 프린터에 연결해요. 프린터와 컴퓨터가 같은 와이파이에
          있어야 합니다.
        </p>
        <ol className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <li className="min-h-[156px] rounded-xl bg-[#f5f5f5] p-6">
            <span className="text-sm font-bold text-[#5a7bff]">01</span>
            <h3 className="mt-3 text-sm font-bold text-gray-950">
              같은 와이파이에 연결
            </h3>
            <p className="mt-3 text-sm leading-5 text-gray-500">
              프린터와 지금 쓰는 컴퓨터를 같은 와이파이에 연결해 주세요.
            </p>
          </li>
          <li className="min-h-[156px] rounded-xl bg-[#f5f5f5] p-6">
            <span className="text-sm font-bold text-[#5a7bff]">02</span>
            <h3 className="mt-3 text-sm font-bold text-gray-950">
              프린터에서 IP 확인
            </h3>
            <p className="mt-3 text-sm leading-5 text-gray-500">
              프린터 화면의 설정 ➔ 네트워크에서 IP 주소를 확인해요.
            </p>
          </li>
          <li className="min-h-[156px] rounded-xl bg-[#f5f5f5] p-6">
            <span className="text-sm font-bold text-[#5a7bff]">03</span>
            <h3 className="mt-3 text-sm font-bold text-gray-950">간편한 등록</h3>
            <p className="mt-3 text-sm leading-5 text-gray-500">
              프린터 이름과 모델을 고르고 IP 주소를 입력하면 끝이에요.
            </p>
          </li>
        </ol>
      </section>

      {isFormOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeForm();
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="printer-form-title"
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
          >
            <h2 id="printer-form-title" className="text-lg font-bold text-gray-950">
              {editingPrinterId ? "프린터 수정" : "프린터 추가"}
            </h2>
            <form className="mt-5 flex flex-col gap-4" onSubmit={savePrinter}>
              <label className="flex flex-col gap-2 text-sm font-medium text-gray-700">
                프린터 이름
                <input
                  required
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((currentDraft) => ({
                      ...currentDraft,
                      name: event.target.value,
                    }))
                  }
                  className="h-11 rounded-lg border border-gray-300 px-3 font-normal text-gray-950 outline-none focus:border-[#5a7bff]"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-gray-700">
                모델
                <select
                  value={draft.model}
                  onChange={(event) =>
                    setDraft((currentDraft) => ({
                      ...currentDraft,
                      model: event.target.value,
                    }))
                  }
                  className="h-11 rounded-lg border border-gray-300 bg-white px-3 font-normal text-gray-950 outline-none focus:border-[#5a7bff]"
                >
                  {!PRINTER_MODELS.includes(draft.model) && (
                    <option value={draft.model}>{draft.model}</option>
                  )}
                  {PRINTER_MODELS.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-gray-700">
                IP 주소
                <input
                  required
                  inputMode="decimal"
                  placeholder="192.168.0.24"
                  value={draft.ipAddress}
                  onChange={(event) =>
                    setDraft((currentDraft) => ({
                      ...currentDraft,
                      ipAddress: event.target.value,
                    }))
                  }
                  className="h-11 rounded-lg border border-gray-300 px-3 font-normal text-gray-950 outline-none focus:border-[#5a7bff]"
                />
              </label>
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="h-10 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="h-10 rounded-lg bg-[#5a7bff] px-4 text-sm font-semibold text-white hover:bg-[#4a6ee5]"
                >
                  저장
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
