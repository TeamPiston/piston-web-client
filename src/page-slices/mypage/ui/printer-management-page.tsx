"use client";

import { useState } from "react";
import {
  getMockPrinterConnectionTestResult,
  getPrintersWithFallback,
  type Printer,
  type PrinterConnectionStatus,
  type PrinterConnectionTestResult,
} from "@/shared/mock/mock-data";
import { PrinterFormModal, type PrinterDraft } from "./printer-form-modal";
import { PrinterDeleteModal } from "./printer-delete-modal";

interface PrinterManagementPageProps {
  initialPrinters?: Printer[];
}

export function PrinterManagementPage({ initialPrinters }: PrinterManagementPageProps) {
  const [printers, setPrinters] = useState<Printer[]>(() =>
    getPrintersWithFallback(initialPrinters),
  );
  const [editingPrinter, setEditingPrinter] = useState<Printer | null>(null);
  const [deletingPrinter, setDeletingPrinter] = useState<Printer | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const isEmpty = printers.length === 0;

  const openAddForm = () => {
    setEditingPrinter(null);
    setIsFormOpen(true);
  };

  const openEditForm = (printer: Printer) => {
    setEditingPrinter(printer);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingPrinter(null);
  };

  const savePrinter = (
    nextPrinter: PrinterDraft,
    testedStatus: PrinterConnectionStatus | null,
  ) => {
    if (!editingPrinter && testedStatus !== "connected") {
      return;
    }

    if (editingPrinter) {
      setPrinters((currentPrinters) =>
        currentPrinters.map((printer) =>
          printer.id === editingPrinter.id
            ? {
                ...printer,
                ...nextPrinter,
                connectionStatus:
                  testedStatus ??
                  (printer.ipAddress === nextPrinter.ipAddress &&
                  printer.model === nextPrinter.model
                    ? printer.connectionStatus
                    : "disconnected"),
              }
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
          connectionStatus: testedStatus ?? "disconnected",
        },
      ]);
      setAnnouncement(`${nextPrinter.name} 프린터를 추가했습니다.`);
    }

    closeForm();
  };

  const testPrinterConnection = (draft: PrinterDraft): PrinterConnectionTestResult => {
    if (!editingPrinter) {
      return getMockPrinterConnectionTestResult(draft.model, draft.ipAddress);
    }
    const printer = printers.find(
      (currentPrinter) =>
        currentPrinter.ipAddress === draft.ipAddress.trim() &&
        currentPrinter.model === draft.model,
    );
    if (!printer) {
      return {
        status: "disconnected",
        message: "이 IP 주소의 연결 정보가 없습니다. 실제 연결 테스트는 서버 연동 후 사용할 수 있어요.",
      };
    }
    return printer.connectionStatus === "connected"
      ? getMockPrinterConnectionTestResult(draft.model, draft.ipAddress)
      : {
          status: "disconnected",
          message: "예시 연결 결과: 연결 끊김. 같은 와이파이와 IP 주소를 확인해 주세요.",
        };
  };

  const deletePrinter = (printerId: string) => {
    if (!deletingPrinter || deletingPrinter.id !== printerId) {
      return;
    }

    setPrinters((currentPrinters) =>
      currentPrinters.filter((currentPrinter) => currentPrinter.id !== printerId),
    );
    setAnnouncement(`${deletingPrinter.name} 프린터를 삭제했습니다.`);
    setDeletingPrinter(null);
  };

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-var(--header-height))] w-full max-w-[1264px] flex-1 flex-col px-4 py-10 sm:px-8 xl:h-[calc(100dvh-var(--header-height))] xl:min-h-0 xl:flex-none xl:overflow-y-auto">
      <div className="flex shrink-0 items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-gray-950">프린터 관리</h1>
        <button
          type="button"
          onClick={openAddForm}
          className="h-10 shrink-0 rounded-md bg-[#5a7bff] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#4a6ee5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5a7bff]"
        >
          프린터 추가
        </button>
      </div>

      <section
        aria-label="등록된 프린터"
        className={`${isEmpty ? "mt-9" : "mt-8"} flex shrink-0 flex-col gap-4`}
      >
        {isEmpty ? (
          <div className="flex min-h-[232px] items-center justify-center rounded-2xl bg-[#f5f5f5] px-6 py-10 text-center">
            <div>
              <h2 className="text-xl font-bold text-gray-950">등록된 프린터가 없어요</h2>
              <p className="mt-2 text-sm leading-5 text-gray-500">
                프린터를 추가하면 만든 디자인을 바로 출력할 수 있어요.
              </p>
            </div>
          </div>
        ) : printers.map((printer) => (
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
                onClick={() => setDeletingPrinter(printer)}
                className="h-10 flex-1 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 sm:flex-none"
              >
                삭제
              </button>
            </div>
          </article>
        ))}
      </section>

      {announcement && (
        <p className="mt-4 text-sm text-gray-600" role="status" aria-live="polite">
          {announcement}
        </p>
      )}

      <section
        className={`${isEmpty ? "mt-8 sm:mt-[168px]" : "mt-8"} shrink-0 rounded-2xl border border-gray-300 bg-white p-6 sm:p-8`}
      >
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
        <PrinterFormModal
          key={editingPrinter?.id ?? "new-printer"}
          printer={editingPrinter}
          onClose={closeForm}
          onSave={savePrinter}
          onTestConnection={testPrinterConnection}
        />
      )}
      {deletingPrinter && (
        <PrinterDeleteModal
          printer={deletingPrinter}
          onClose={() => setDeletingPrinter(null)}
          onConfirm={deletePrinter}
        />
      )}
    </main>
  );
}
