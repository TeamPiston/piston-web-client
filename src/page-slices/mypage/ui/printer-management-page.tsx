"use client";

import { useCallback, useRef } from "react";
import { PrinterCard, usePrinterQuery } from "@/entities/printer";
import {
  usePrinterManagement,
  AddPrinterButton,
  PrinterControls,
  PrinterFormModal,
  PrinterDeleteModal,
} from "@/features/printer-management";

interface PrinterManagementPageProps {
  previewEmpty?: boolean;
}

export function PrinterManagementPage({ previewEmpty = false }: PrinterManagementPageProps) {
  const { printers } = usePrinterQuery();
  const management = usePrinterManagement();
  const addPrinterRef = useRef<HTMLButtonElement>(null);
  const printerListRef = useRef<HTMLElement>(null);
  const getFallbackFocusTargets = useCallback(
    () => [addPrinterRef.current, printerListRef.current],
    [],
  );
  // Design preview changes presentation only; all actions still belong to the root provider.
  const isEmpty = previewEmpty || printers.length === 0;

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-var(--header-height))] w-full max-w-[1264px] flex-1 flex-col px-4 py-10 sm:px-8 xl:h-[calc(100dvh-var(--header-height))] xl:min-h-0 xl:flex-none xl:overflow-y-auto">
      <div className="flex shrink-0 items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-gray-950">프린터 관리</h1>
        <AddPrinterButton ref={addPrinterRef} disabled={previewEmpty} onClick={management.openAddForm} />
      </div>

      <section
        ref={printerListRef}
        tabIndex={-1}
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
          <PrinterCard
            key={printer.id}
            printer={printer}
            actions={
              <PrinterControls
                printer={printer}
                onCheckConnection={management.checkPrinterConnection}
                onEdit={management.openEditForm}
                onDelete={management.openDeleteForm}
              />
            }
          />
        ))}
      </section>

      {management.announcement && (
        <p className="mt-4 text-sm text-gray-600" role="status" aria-live="polite">
          {management.announcement}
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

      {!previewEmpty && management.isFormOpen && (
        <PrinterFormModal
          key={management.editingPrinter?.id ?? "new-printer"}
          printer={management.editingPrinter}
          onClose={management.closeForm}
          onSave={management.savePrinter}
          onTestConnection={management.testPrinterConnection}
        />
      )}
      {!previewEmpty && management.deletingPrinter && (
        <PrinterDeleteModal
          printer={management.deletingPrinter}
          onClose={management.closeDeleteForm}
          onConfirm={management.deletePrinter}
          getFallbackFocusTargets={getFallbackFocusTargets}
        />
      )}
    </main>
  );
}
