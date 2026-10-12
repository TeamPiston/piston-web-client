"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { usePrinter } from "@/entities/printer";
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
import type {
  AttachedImage,
  ChatHistory,
  ChatMessage,
  DesignVersion,
  PrintSuccessPhase,
  ResolvedArtworkModelParams,
} from "../model/types";
import { ChatPanel } from "./components/chat-panel";
import { HistorySidebar } from "./components/history-sidebar";
import { PreviewPanel } from "./components/preview-panel";
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
  const { connectedPrinter, isPrinterConnected, startPrint } = usePrinter();
  const isDesktop = useSyncExternalStore(
    subscribeToDesktopMediaQuery,
    getDesktopSnapshot,
    getServerDesktopSnapshot,
  );
  const [draft, setDraft] = useState("");
  const [attachedImage, setAttachedImage] = useState<AttachedImage | null>(null);
  const selectedFileName = attachedImage ? attachedImage.name : null;
  const [editingHistoryId, setEditingHistoryId] = useState<string | null>(null);
  const [editingHistoryTitle, setEditingHistoryTitle] = useState("");
  const [chatHistories, setChatHistories] = useState(INITIAL_CHAT_HISTORIES);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const [isPrintBlocked, setIsPrintBlocked] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
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
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    return () => {
      if (attachedImage) {
        URL.revokeObjectURL(attachedImage.url);
      }
    };
  }, [attachedImage]);

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
    if (!prompt && !attachedImage) {
      return;
    }

    const userContent = attachedImage && selectedFileName
      ? `${prompt || "참고 이미지를 바탕으로 디자인을 만들어 주세요."}\n참고 이미지: ${selectedFileName}`
      : prompt;

    appendMockResponse(userContent, prompt);
    setDraft("");
    setAttachedImage(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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
    if (!isGenerated || isPrintBlocked) {
      return;
    }

    if (!isPrinterConnected) {
      setIsPrintModalOpen(false);
      setIsPrinterConnectionModalOpen(true);
      return;
    }

    setIsPrinterConnectionModalOpen(false);
    setIsPrintModalOpen(true);
  };

  const handlePrintConfirm = ({ colorMode }: { colorMode: string }) => {
    if (!isGenerated || isPrintBlocked) {
      return;
    }

    const didStartPrint = connectedPrinter ? startPrint({
      colorMode,
      printerId: connectedPrinter.id,
      stlUrl: currentModelParams.stlUrl,
      title: versions.find((version) => version.id === selectedVersionId)?.description ?? "3D 디자인",
    }) : false;
    if (!didStartPrint) {
      setIsPrintModalOpen(false);
      setIsPrinterConnectionModalOpen(true);
      return;
    }

    setIsPrintModalOpen(false);
    setPrintSuccessPhase("visible");
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

  const attachImage = (file: File) => {
    if (!file.type.startsWith("image/")) {
      return;
    }

    setAttachedImage({
      name: file.name || "붙여넣은 이미지",
      url: URL.createObjectURL(file),
    });
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const [file] = Array.from(event.target.files ?? []);
    if (file) {
      attachImage(file);
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const imageFile = Array.from(event.clipboardData.files).find((file) =>
      file.type.startsWith("image/"),
    );

    if (imageFile) {
      event.preventDefault();
      attachImage(imageFile);
    }
  };

  const handleRemoveAttachment = () => {
    setAttachedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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
    setAttachedImage(null);
    setPrintSuccessPhase("hidden");
    setSelectedVersionId("v3");
    setVersions([]);
    nextVersionNumberRef.current = 1;
    setCurrentModelParams(resolveModelParams(MOCK_VERSIONS[2]));
    setCameraDistance(42);
    setIsHistoryOpen(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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
    <>
      <Header />
      <main className="relative min-h-[calc(100vh-100px)] overflow-hidden bg-white xl:h-[calc(100vh-100px)]">
        <div className="grid min-h-[calc(100vh-100px)] xl:h-full xl:grid-cols-[360px_minmax(0,1fr)_360px]">
          <aside className="relative hidden border-r border-gray-200 bg-white xl:block">
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

          <section className="grid min-h-[calc(100vh-100px)] min-w-0 lg:grid-cols-2">
            <ChatPanel
              attachedImage={attachedImage}
              draft={draft}
              draftTextareaRef={draftTextareaRef}
              fileInputRef={fileInputRef}
              isGenerated={isGenerated}
              isLoading={isLoading}
              isPrintBlocked={isPrintBlocked}
              messages={messages}
              onDraftChange={setDraft}
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
        isOpen={isPrintModalOpen}
        isPrinterConnected={isPrinterConnected}
        printer={connectedPrinter}
        estimatedPrintTime={CREATE_ESTIMATED_PRINT_TIME}
        filamentColors={CREATE_FILAMENT_COLORS}
        filamentUsage={CREATE_FILAMENT_USAGE}
        onClose={handlePrintModalClose}
        onConfirm={handlePrintConfirm}
        onOpenPrinterManagement={handleOpenPrinterManagement}
      />
      <PrinterDisconnectedModal
        isOpen={isPrinterConnectionModalOpen}
        stlUrl={currentModelParams.stlUrl}
        onClose={handlePrinterConnectionModalClose}
        onOpenPrinterManagement={handleOpenPrinterManagement}
      />
    </>
  );
}
