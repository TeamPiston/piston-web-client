"use client";

import { useCallback, useRef, type ReactNode } from "react";
import { PrinterCard, usePrinterQuery, type Printer } from "@/entities/printer";
import { useAuth } from "@/entities/session";
import {
  usePrinterManagement,
  useApiPrinterManagement,
  AddPrinterButton,
  ApiPrinterFormModal,
  PrinterControls,
  PrinterFormModal,
  PrinterDeleteModal,
} from "@/features/printer-management";

interface PrinterManagementPageProps {
  previewEmpty?: boolean;
}

function usePrinterManagementFocus() {
  const addPrinterRef = useRef<HTMLButtonElement>(null);
  const printerListRef = useRef<HTMLElement>(null);
  const getFallbackFocusTargets = useCallback(
    () => [addPrinterRef.current, printerListRef.current],
    [],
  );
  return { addPrinterRef, printerListRef, getFallbackFocusTargets };
}

interface PrinterManagementView<P extends Printer> {
  printers: readonly P[];
  focus: ReturnType<typeof usePrinterManagementFocus>;
  openAddForm: () => void;
  renderControls: (printer: P) => ReactNode;
  announcement: string;
  dialogs: ReactNode;
  previewEmpty?: boolean;
  api?: boolean;
  isLoading?: boolean;
  loadError?: string;
  actionError?: string;
  addDisabled?: boolean;
  reload?: () => void;
}

function renderPrinterManagement<P extends Printer>({
  printers, focus, openAddForm, renderControls, announcement, dialogs, previewEmpty = false,
  api = false, isLoading = false, loadError, actionError, addDisabled = false, reload,
}: PrinterManagementView<P>) {
  const { addPrinterRef, printerListRef } = focus;
  // Design preview changes presentation only; all actions still belong to the root provider.
  const isEmpty = previewEmpty || printers.length === 0;

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-var(--header-height))] w-full max-w-[1264px] flex-1 flex-col px-4 py-10 sm:px-8 xl:h-[calc(100dvh-var(--header-height))] xl:min-h-0 xl:flex-none xl:overflow-y-auto">
      <div className="flex shrink-0 items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-gray-950">프린터 관리</h1>
        <AddPrinterButton ref={addPrinterRef} disabled={previewEmpty || addDisabled} onClick={openAddForm} />
      </div>

      <section
        ref={printerListRef}
        tabIndex={-1}
        aria-label="등록된 프린터"
        className={`${isEmpty ? "mt-9" : "mt-8"} flex shrink-0 flex-col gap-4`}
      >
        {isLoading ? (
          <p role="status" className="py-8 text-sm text-gray-600">프린터를 불러오는 중이에요.</p>
        ) : loadError ? (
          <div className="py-8">
            <p role="alert" className="text-sm text-red-600">{loadError}</p>
            {reload && (
              <button type="button" onClick={reload} className="mt-3 h-10 rounded-lg border border-gray-300 px-4 text-sm">
                다시 시도
              </button>
            )}
          </div>
        ) : isEmpty ? (
          <div className="flex min-h-[232px] items-center justify-center rounded-2xl bg-[#f5f5f5] px-6 py-10 text-center">
            <div>
              <h2 className="text-xl font-bold text-gray-950">등록된 프린터가 없어요</h2>
              <p className="mt-2 text-sm leading-5 text-gray-500">
                {api ? "프린터 정보를 추가해 목록에서 관리할 수 있어요." : "프린터를 추가하면 만든 디자인을 바로 출력할 수 있어요."}
              </p>
            </div>
          </div>
        ) : printers.map((printer) => (
          <PrinterCard
            key={printer.id}
            printer={printer}
            actions={renderControls(printer)}
          />
        ))}
      </section>

      {announcement && <p className="mt-4 text-sm text-gray-600" role="status">{announcement}</p>}
      {actionError && <p className="mt-4 text-sm text-red-600" role="alert">{actionError}</p>}

      <section
        className={`${isEmpty ? "mt-8 sm:mt-[168px]" : "mt-8"} shrink-0 rounded-2xl border border-gray-300 bg-white p-6 sm:p-8`}
      >
        <h2 className="text-base font-bold text-gray-950">
          연결하기 전에 확인해 주세요
        </h2>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          {api
            ? "이 화면에서 등록 정보를 관리할 수 있어요. 연결 테스트와 등록한 프린터를 선택하는 출력은 지원하지 않아요."
            : "PISTON은 무선으로만 프린터에 연결해요. 프린터와 컴퓨터가 같은 와이파이에 있어야 합니다."}
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
              {api ? "프린터 이름, 종류와 전체 URL을 입력해 주세요." : "프린터 이름과 모델을 고르고 IP 주소를 입력하면 끝이에요."}
            </p>
          </li>
        </ol>
      </section>

      {!previewEmpty && dialogs}
    </main>
  );
}

export function PrinterManagementPage({ previewEmpty = false }: PrinterManagementPageProps) {
  const { printers } = usePrinterQuery();
  const management = usePrinterManagement();
  const focus = usePrinterManagementFocus();
  const dialogs = (
    <>
      {management.isFormOpen && (
        <PrinterFormModal
          key={management.editingPrinter?.id ?? "new-printer"}
          printer={management.editingPrinter}
          onClose={management.closeForm}
          onSave={management.savePrinter}
          onTestConnection={management.testPrinterConnection}
        />
      )}
      {management.deletingPrinter && (
        <PrinterDeleteModal
          printer={management.deletingPrinter}
          onClose={management.closeDeleteForm}
          onConfirm={management.deletePrinter}
          getFallbackFocusTargets={focus.getFallbackFocusTargets}
        />
      )}
    </>
  );
  return renderPrinterManagement({
    printers, focus, previewEmpty, dialogs,
    openAddForm: management.openAddForm,
    announcement: management.announcement,
    renderControls: (printer) => (
      <PrinterControls
        printer={printer}
        onCheckConnection={management.checkPrinterConnection}
        onEdit={management.openEditForm}
        onDelete={management.openDeleteForm}
      />
    ),
  });
}

export function ApiPrinterManagementPage() {
  const { user, apiSessionId, isLoggedIn, isRestoring } = useAuth();
  if (isRestoring) {
    return <p role="status" className="mx-auto py-10 text-sm text-gray-600">로그인 상태를 확인하는 중이에요.</p>;
  }
  if (!isLoggedIn || !user?.userId || !apiSessionId) {
    return <p role="status" className="mx-auto py-10 text-sm text-gray-600">프린터를 관리하려면 로그인해 주세요.</p>;
  }
  return <ApiPrinterManagementSession key={apiSessionId} sessionId={apiSessionId} userId={user.userId} />;
}

function ApiPrinterManagementSession({ userId, sessionId }: { userId: string; sessionId: string }) {
  const management = useApiPrinterManagement(userId, sessionId);
  const focus = usePrinterManagementFocus();
  const dialogs = (
    <>
      {management.form && (
        <ApiPrinterFormModal
          key={management.form.printer?.id ?? "new-printer"}
          printer={management.form.printer}
          busy={management.busy}
          error={management.actionError}
          onClose={management.closeForm}
          onSave={management.savePrinter}
        />
      )}
      {management.deletingPrinter && (
        <PrinterDeleteModal
          api
          printer={management.deletingPrinter}
          busy={management.busy}
          error={management.actionError}
          onClose={management.closeDeleteForm}
          onConfirm={management.deletePrinter}
          getFallbackFocusTargets={focus.getFallbackFocusTargets}
        />
      )}
    </>
  );
  return renderPrinterManagement({
    api: true, focus, dialogs,
    printers: management.printers,
    isLoading: management.isLoading,
    loadError: management.loadError,
    actionError: management.form || management.deletingPrinter ? undefined : management.actionError,
    reload: management.reload,
    addDisabled: management.isLoading || management.busy || !!management.loadError,
    openAddForm: management.openAddForm,
    announcement: management.announcement,
    renderControls: (printer) => (
      <PrinterControls
        printer={printer}
        disabled={management.busy}
        onEdit={() => void management.openEditForm(printer)}
        onDelete={() => management.openDeleteForm(printer)}
      />
    ),
  });
}
