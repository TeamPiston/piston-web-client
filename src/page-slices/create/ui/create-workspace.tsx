"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { isMockPrinterConnected } from "@/shared/mock/mock-data";
import { usePrinterQuery } from "@/entities/printer";
import { PrintSettingsModal } from "@/features/print-artwork";
import { Header } from "@/widgets/header";
import {
  CREATE_ESTIMATED_PRINT_TIME,
  CREATE_FILAMENT_COLORS,
  CREATE_FILAMENT_USAGE,
  INITIAL_CHAT_HISTORIES,
} from "../model/mock-data";
import { useCreateAttachments } from "../model/use-create-attachments";
import { useCreateGeneration } from "../model/use-create-generation";
import { useCreatePrintFlow } from "../model/use-create-print-flow";
import type { ChatHistory } from "../model/types";
import { ChatPanel } from "./components/chat-panel";
import { HistorySidebar } from "./components/history-sidebar";
import { PreviewPanel } from "./components/preview-panel";
import { PrintInProgressModal } from "./components/print-in-progress-modal";
import { PrinterDisconnectedModal } from "./components/printer-disconnected-modal";
import { VersionHistory } from "./components/version-history";

const DESKTOP_MEDIA_QUERY = "(min-width: 80rem)";

const subscribeToDesktopMediaQuery = (onChange: () => void) => {
  const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);
  mediaQuery.addEventListener("change", onChange);

  return () => mediaQuery.removeEventListener("change", onChange);
};

const getDesktopSnapshot = () => window.matchMedia(DESKTOP_MEDIA_QUERY).matches;

const getServerDesktopSnapshot = () => false;

export default function CreateWorkspace() {
  const router = useRouter();
  const { connectedPrinter, isPrinterConnected: hasConnectedPrinter } = usePrinterQuery();
  const isPrinterConnected = hasConnectedPrinter && isMockPrinterConnected();
  const isDesktop = useSyncExternalStore(
    subscribeToDesktopMediaQuery,
    getDesktopSnapshot,
    getServerDesktopSnapshot,
  );
  const [draft, setDraft] = useState("");
  const {
    attachedImages,
    isLimitExceeded,
    fileInputRef,
    handleFileChange,
    handlePaste,
    handleDrop,
    handleDragOver,
    handleRemoveAttachment,
    resetAttachments,
    clearLimitExceeded,
  } = useCreateAttachments();
  const [editingHistoryId, setEditingHistoryId] = useState<string | null>(null);
  const [editingHistoryTitle, setEditingHistoryTitle] = useState("");
  const [chatHistories, setChatHistories] = useState(INITIAL_CHAT_HISTORIES);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const {
    messages,
    isLoading,
    isGenerated,
    isPrintBlocked,
    versions,
    selectedVersionId,
    currentModelParams,
    startGeneration,
    handleAutoFix,
    handleVersionSelect,
    resetGeneration,
  } = useCreateGeneration();
  const {
    isPrintModalOpen,
    isPrintInProgressModalOpen,
    isPrintStatusChecking,
    isPrintCheckFailed,
    isPrintStarting,
    printStartError,
    currentPrintTask,
    isPrinterConnectionModalOpen,
    printSuccessPhase,
    handlePrintOpen,
    handlePrintConfirm,
    handlePrintModalClose,
    handlePrinterConnectionModalClose,
    handlePrintInProgressModalClose,
    closePrintSetup,
    resetPrintFlow,
  } = useCreatePrintFlow({ isGenerated, isPrintBlocked, isPrinterConnected });
  const [cameraDistance, setCameraDistance] = useState(42);
  const draftTextareaRef = useRef<HTMLTextAreaElement>(null);
  const printButtonRef = useRef<HTMLButtonElement>(null);
  const historyTitleInputRef = useRef<HTMLInputElement>(null);
  const isCancelingHistoryEditRef = useRef(false);

  useEffect(() => {
    if (editingHistoryId) {
      historyTitleInputRef.current?.focus();
      historyTitleInputRef.current?.select();
    }
  }, [editingHistoryId, isDesktop, isHistoryOpen]);

  useEffect(() => {
    const textarea = draftTextareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    textarea.style.overflowY = textarea.scrollHeight > 200 ? "auto" : "hidden";
  }, [draft]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const prompt = draft.trim();
    if (!prompt && attachedImages.length === 0) {
      return;
    }

    const imageNames = attachedImages.map((image) => image.name).join(", ");
    const userContent = imageNames
      ? `${prompt || "참고 이미지를 바탕으로 디자인을 만들어 주세요."}\n참고 이미지: ${imageNames}`
      : prompt;

    if (!startGeneration({ prompt, userContent })) {
      return;
    }

    closePrintSetup();
    setDraft("");
    resetAttachments();
  };

  const handleOpenPrinterManagement = useCallback(() => {
    closePrintSetup();
    router.push("/mypage?tab=printer");
  }, [closePrintSetup, router]);

  const handleDraftChange = (value: string) => {
    setDraft(value);
    clearLimitExceeded();
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) {
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  const handleZoom = (direction: "in" | "out") => {
    setCameraDistance((currentDistance) =>
      direction === "in"
        ? Math.max(26, currentDistance - 4)
        : Math.min(70, currentDistance + 4),
    );
  };

  const handleNewChat = () => {
    resetGeneration();
    setDraft("");
    setEditingHistoryId(null);
    resetPrintFlow();
    resetAttachments();
    setCameraDistance(42);
    setIsHistoryOpen(false);
  };

  const handleStartHistoryEdit = (history: ChatHistory) => {
    isCancelingHistoryEditRef.current = false;
    setEditingHistoryId(history.id);
    setEditingHistoryTitle(history.title);
  };

  const handleSaveHistoryTitle = () => {
    if (!editingHistoryId) {
      return;
    }

    if (isCancelingHistoryEditRef.current) {
      isCancelingHistoryEditRef.current = false;
      return;
    }

    const nextTitle = editingHistoryTitle.trim();
    if (nextTitle) {
      setChatHistories((currentHistories) =>
        currentHistories.map((history) =>
          history.id === editingHistoryId ? { ...history, title: nextTitle } : history,
        ),
      );
    }

    setEditingHistoryId(null);
    setEditingHistoryTitle("");
  };

  const handleHistoryTitleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSaveHistoryTitle();
    }

    if (event.key === "Escape") {
      event.preventDefault();
      isCancelingHistoryEditRef.current = true;
      setEditingHistoryId(null);
      setEditingHistoryTitle("");
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1920px] flex-col overflow-x-clip bg-white xl:h-dvh xl:min-h-0 xl:overflow-x-hidden xl:overflow-y-auto">
      <Header />
      <main className="relative min-h-[calc(100dvh-var(--header-height))] w-full flex-1 bg-white xl:h-[calc(100dvh-var(--header-height))] xl:min-h-[720px] xl:flex-none xl:overflow-hidden">
        <div className="grid min-h-[calc(100dvh-var(--header-height))] xl:h-full xl:min-h-0 xl:grid-cols-[280px_minmax(0,1fr)_280px] xl:grid-rows-[minmax(0,1fr)] 2xl:grid-cols-[360px_minmax(0,1fr)_360px]">
          <aside className="relative hidden min-h-0 border-r border-gray-200 bg-white xl:block">
            {isDesktop && isHistoryOpen && (
              <HistorySidebar
                chatHistories={chatHistories}
                editingHistoryId={editingHistoryId}
                editingHistoryTitle={editingHistoryTitle}
                historyTitleInputRef={historyTitleInputRef}
                onClose={() => setIsHistoryOpen(false)}
                onEditTitle={handleStartHistoryEdit}
                onSaveTitle={handleSaveHistoryTitle}
                onTitleChange={setEditingHistoryTitle}
                onTitleKeyDown={handleHistoryTitleKeyDown}
                onNewChat={handleNewChat}
              />
            )}
          </aside>

          <section className="grid min-h-[calc(100dvh-var(--header-height))] min-w-0 lg:grid-cols-2 xl:min-h-0 xl:grid-rows-[minmax(0,1fr)]">
            <ChatPanel
              attachedImages={attachedImages}
              isLimitExceeded={isLimitExceeded}
              draft={draft}
              draftTextareaRef={draftTextareaRef}
              fileInputRef={fileInputRef}
              isGenerated={isGenerated}
              isLoading={isLoading}
              isPrintBlocked={isPrintBlocked}
              messages={messages}
              onDraftChange={handleDraftChange}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onFileChange={handleFileChange}
              onInputKeyDown={handleInputKeyDown}
              onAutoFix={handleAutoFix}
              onPaste={handlePaste}
              onRemoveAttachment={handleRemoveAttachment}
              onSubmit={handleSubmit}
              onToggleHistory={() => setIsHistoryOpen((isOpen) => !isOpen)}
            />
            <PreviewPanel
              cameraDistance={cameraDistance}
              isGenerated={isGenerated}
              isPrintBlocked={isPrintBlocked}
              isPrintCheckFailed={isPrintCheckFailed}
              isPrintStatusChecking={isPrintStatusChecking}
              onRetryPrintCheck={handlePrintOpen}
              modelParams={currentModelParams}
              onPrint={handlePrintOpen}
              printSuccessPhase={printSuccessPhase}
              printButtonRef={printButtonRef}
              onZoom={handleZoom}
            />
          </section>

          <VersionHistory
            isGenerated={isGenerated}
            selectedVersionId={selectedVersionId}
            onSelectVersion={handleVersionSelect}
            versions={versions}
          />
        </div>

        {!isDesktop && isHistoryOpen && (
          <div className="absolute inset-0 z-30 bg-black/10 xl:hidden">
            <div className="h-full w-[min(360px,calc(100vw-28px))]">
              <HistorySidebar
                chatHistories={chatHistories}
                editingHistoryId={editingHistoryId}
                editingHistoryTitle={editingHistoryTitle}
                historyTitleInputRef={historyTitleInputRef}
                onClose={() => setIsHistoryOpen(false)}
                onEditTitle={handleStartHistoryEdit}
                onSaveTitle={handleSaveHistoryTitle}
                onTitleChange={setEditingHistoryTitle}
                onTitleKeyDown={handleHistoryTitleKeyDown}
                onNewChat={handleNewChat}
              />
            </div>
          </div>
        )}
      </main>
      <PrintSettingsModal
        returnFocusRef={printButtonRef}
        isOpen={isPrintModalOpen && !isPrintCheckFailed && !isPrintStatusChecking}
        errorMessage={printStartError}
        isSubmitting={isPrintStarting}
        isPrinterConnected={isPrinterConnected}
        printer={connectedPrinter}
        estimatedPrintTime={CREATE_ESTIMATED_PRINT_TIME}
        filamentColors={CREATE_FILAMENT_COLORS}
        filamentUsage={CREATE_FILAMENT_USAGE}
        onClose={handlePrintModalClose}
        onConfirm={handlePrintConfirm}
        onOpenPrinterManagement={handleOpenPrinterManagement}
      />
      {currentPrintTask?.status === "PRINTING" && (
        <PrintInProgressModal
          isOpen={isPrintInProgressModalOpen}
          printTask={currentPrintTask}
          onClose={handlePrintInProgressModalClose}
          onOpenMyPage={() => router.push("/mypage")}
        />
      )}
      <PrinterDisconnectedModal
        isOpen={isPrinterConnectionModalOpen}
        stlUrl={currentModelParams.stlUrl}
        onClose={handlePrinterConnectionModalClose}
        onOpenPrinterManagement={handleOpenPrinterManagement}
      />
    </div>
  );
}
