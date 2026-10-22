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
import { createPrintTask, getCurrentPrintTask, type PrintTask } from "@/entities/print";
import { isMockPrinterConnected } from "@/shared/mock/mock-data";
import { usePrinterQuery } from "@/entities/printer";
import { PrintSettingsModal } from "@/features/print-artwork";
import { Header } from "@/widgets/header";
import {
  COPYRIGHT_KEYWORDS,
  CREATE_ESTIMATED_PRINT_TIME,
  CREATE_FILAMENT_COLORS,
  CREATE_FILAMENT_USAGE,
  INITIAL_CHAT_HISTORIES,
  MOCK_COPYRIGHT_WARNING,
  MOCK_CORRECTED_VERSION,
  MOCK_PRINT_WARNING,
  MOCK_VERSIONS,
} from "../model/mock-data";
import { createPrintCorrection, resolveModelParams } from "../model/model-utils";
import { useCreateAttachments } from "../model/use-create-attachments";
import type {
  ChatHistory,
  ChatMessage,
  DesignVersion,
  PrintSuccessPhase,
  ResolvedArtworkModelParams,
} from "../model/types";
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
  const [isGenerated, setIsGenerated] = useState(false);
  const [isPrintBlocked, setIsPrintBlocked] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isPrintInProgressModalOpen, setIsPrintInProgressModalOpen] = useState(false);
  const [isPrintStatusChecking, setIsPrintStatusChecking] = useState(false);
  const [isPrintCheckFailed, setIsPrintCheckFailed] = useState(false);
  const [isPrintStarting, setIsPrintStarting] = useState(false);
  const [printStartError, setPrintStartError] = useState<string | null>(null);
  const [currentPrintTask, setCurrentPrintTask] = useState<PrintTask | null>(null);
  const [isPrinterConnectionModalOpen, setIsPrinterConnectionModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [printSuccessPhase, setPrintSuccessPhase] = useState<PrintSuccessPhase>("hidden");
  const [selectedVersionId, setSelectedVersionId] = useState("v3");
  const [versions, setVersions] = useState<DesignVersion[]>([]);
  const [currentModelParams, setCurrentModelParams] = useState<ResolvedArtworkModelParams>(
    () => resolveModelParams(MOCK_VERSIONS[2]),
  );
  const [cameraDistance, setCameraDistance] = useState(42);
  const draftTextareaRef = useRef<HTMLTextAreaElement>(null);
  const historyTitleInputRef = useRef<HTMLInputElement>(null);
  const nextVersionNumberRef = useRef(1);
  const loadingTimeoutRef = useRef<number | null>(null);
  const isCancelingHistoryEditRef = useRef(false);
  const autoFixedMessageIdsRef = useRef(new Set<string>());

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

  useEffect(() => {
    return () => {
      if (loadingTimeoutRef.current !== null) {
        window.clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (printSuccessPhase !== "visible") {
      return;
    }

    const fadeTimeoutId = window.setTimeout(() => setPrintSuccessPhase("fading"), 3500);
    const hideTimeoutId = window.setTimeout(() => setPrintSuccessPhase("hidden"), 4000);

    return () => {
      window.clearTimeout(fadeTimeoutId);
      window.clearTimeout(hideTimeoutId);
    };
  }, [printSuccessPhase]);

  const appendVersion = (version: Omit<DesignVersion, "id" | "label">) => {
    const versionId = `v${nextVersionNumberRef.current++}`;
    const nextVersion: DesignVersion = {
      ...version,
      id: versionId,
      label: versionId,
    };

    setVersions((currentVersions) => [...currentVersions, nextVersion]);
    setSelectedVersionId(versionId);
    setCurrentModelParams(resolveModelParams(nextVersion));
    setIsGenerated(true);
  };

  const appendMockResponse = (userContent: string, prompt: string) => {
    const normalizedPrompt = prompt.toLowerCase();
    const hasCopyrightIssue = COPYRIGHT_KEYWORDS.some((keyword) =>
      normalizedPrompt.includes(keyword),
    );
    const hasPrintIssue = !hasCopyrightIssue && ["얇게", "최대한 얇게", "얇은"].some(
      (keyword) => prompt.includes(keyword),
    );
    const assistantMessageId = crypto.randomUUID();
    const assistantMessage: ChatMessage = hasCopyrightIssue
      ? {
          id: assistantMessageId,
          role: "assistant",
          content: MOCK_COPYRIGHT_WARNING.title,
          copyrightWarning: MOCK_COPYRIGHT_WARNING,
          isCopyrightIssue: true,
        }
      : hasPrintIssue
        ? {
            id: assistantMessageId,
            role: "assistant",
            content: MOCK_PRINT_WARNING.title,
            hasPrintIssue: true,
            printWarning: MOCK_PRINT_WARNING,
          }
        : {
            id: assistantMessageId,
            role: "assistant",
            content:
              "육각형 연필꽂이를 생성했어요. 높이와 바닥 지름을 조정하면서 원하는 형태로 다듬어 보세요.",
          };

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: userContent,
    };
    setMessages((currentMessages) => [...currentMessages, userMessage]);
    setIsLoading(true);
    setIsPrintModalOpen(false);
    setIsPrinterConnectionModalOpen(false);

    loadingTimeoutRef.current = window.setTimeout(() => {
      loadingTimeoutRef.current = null;
      setIsLoading(false);
      setMessages((currentMessages) => [...currentMessages, assistantMessage]);

      if (hasCopyrightIssue) {
        return;
      }

      const generatedVersions = nextVersionNumberRef.current === 1
        ? MOCK_VERSIONS
        : [MOCK_VERSIONS[2]];
      generatedVersions.forEach(appendVersion);
      setIsPrintBlocked(hasPrintIssue);
    }, 1800);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isLoading) {
      return;
    }

    const prompt = draft.trim();
    if (!prompt && attachedImages.length === 0) {
      return;
    }

    const imageNames = attachedImages.map((image) => image.name).join(", ");
    const userContent = imageNames
      ? `${prompt || "참고 이미지를 바탕으로 디자인을 만들어 주세요."}\n참고 이미지: ${imageNames}`
      : prompt;

    appendMockResponse(userContent, prompt);
    setDraft("");
    resetAttachments();
  };

  const handleAutoFix = (messageId: string) => {
    const warningMessage = [...messages].reverse().find((message) => message.hasPrintIssue);
    if (
      isLoading ||
      !isPrintBlocked ||
      warningMessage?.id !== messageId ||
      !warningMessage.printWarning ||
      warningMessage.isPrintIssueResolved ||
      autoFixedMessageIdsRef.current.has(messageId)
    ) {
      return;
    }

    // Block repeat events before React commits the disabled button state.
    autoFixedMessageIdsRef.current.add(messageId);
    const correction = createPrintCorrection(warningMessage.printWarning);
    const correctionMessages: ChatMessage[] = [
      { id: crypto.randomUUID(), role: "user", content: "규격에 맞게 자동 수정" },
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: correction.title,
        printCorrection: correction,
      },
    ];

    setMessages((currentMessages) => [
      ...currentMessages.map((message) =>
        message.id === messageId ? { ...message, isPrintIssueResolved: true } : message,
      ),
      ...correctionMessages,
    ]);
    setIsPrintBlocked(false);
    appendVersion(MOCK_CORRECTED_VERSION);
  };

  const handlePrintOpen = () => {
    if (!isGenerated || isPrintBlocked || isPrintStatusChecking) {
      return;
    }

    setIsPrintStatusChecking(true);

    void getCurrentPrintTask()
      .then((printTask) => {
        setCurrentPrintTask(printTask);
        setIsPrintCheckFailed(false);

        if (printTask?.status === "PRINTING") {
          setIsPrintModalOpen(false);
          setIsPrinterConnectionModalOpen(false);
          setIsPrintInProgressModalOpen(true);
          return;
        }

        if (!isPrinterConnected) {
          setPrintStartError(null);
          setIsPrintModalOpen(false);
          setIsPrinterConnectionModalOpen(true);
          return;
        }

        setIsPrinterConnectionModalOpen(false);
        setPrintStartError(null);
        setIsPrintModalOpen(true);
      })
      .catch(() => {
        setIsPrintCheckFailed(true);
        setIsPrintModalOpen(false);
        setIsPrintInProgressModalOpen(false);
        setIsPrinterConnectionModalOpen(false);
      })
      .finally(() => {
        setIsPrintStatusChecking(false);
      });
  };

  const handlePrintConfirm = ({ colorMode }: { colorMode: string }) => {
    if (isPrintStarting || isPrintCheckFailed || isPrintStatusChecking || !isPrintModalOpen) {
      return;
    }

    // TODO: 백엔드 API 연동 시 colorMode를 요청 body에 포함하여 전달
    void colorMode;
    setIsPrintStarting(true);
    setPrintStartError(null);

    void createPrintTask()
      .then(() => {
        setIsPrintModalOpen(false);
        setPrintSuccessPhase("visible");
      })
      .catch(() => {
        setPrintStartError("출력 시작에 실패했어요. 잠시 후 다시 시도해 주세요.");
      })
      .finally(() => {
        setIsPrintStarting(false);
      });
  };

  const handlePrintModalClose = useCallback(() => {
    setIsPrintModalOpen(false);
  }, []);

  const handlePrinterConnectionModalClose = useCallback(() => {
    setIsPrinterConnectionModalOpen(false);
  }, []);

  const handleOpenPrinterManagement = useCallback(() => {
    setIsPrintModalOpen(false);
    setIsPrinterConnectionModalOpen(false);
    router.push("/mypage?tab=printer");
  }, [router]);

  const handleVersionSelect = (versionId: string) => {
    const nextVersion = versions.find((version) => version.id === versionId);
    if (!nextVersion) {
      return;
    }

    setSelectedVersionId(nextVersion.id);
    setCurrentModelParams(resolveModelParams(nextVersion));
  };

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
    if (loadingTimeoutRef.current !== null) {
      window.clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }

    setDraft("");
    setEditingHistoryId(null);
    setIsGenerated(false);
    setIsPrintBlocked(false);
    setIsPrintModalOpen(false);
    setIsPrinterConnectionModalOpen(false);
    setIsLoading(false);
    setMessages([]);
    autoFixedMessageIdsRef.current.clear();
    resetAttachments();
    setIsPrintInProgressModalOpen(false);
    setIsPrintStatusChecking(false);
    setIsPrintCheckFailed(false);
    setIsPrintStarting(false);
    setPrintStartError(null);
    setCurrentPrintTask(null);
    setPrintSuccessPhase("hidden");
    setSelectedVersionId("v3");
    setVersions([]);
    nextVersionNumberRef.current = 1;
    setCurrentModelParams(resolveModelParams(MOCK_VERSIONS[2]));
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
          onClose={() => setIsPrintInProgressModalOpen(false)}
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
