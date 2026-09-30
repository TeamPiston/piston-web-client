"use client";

import {
  CornerDownLeft,
  Download,
  Menu,
  Minus,
  Move3d,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useAuth } from "@/entities/session";
import { ArtworkModelPreview } from "@/features/stl-viewer";
import { PistonLogo } from "@/shared/ui";
import { Header, LoginRequiredModal } from "@/widgets/header";

const subscribeToHydration = () => () => {};
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

type MessageRole = "assistant" | "user";

interface PrintIssue {
  current: string;
  label: string;
  required: string;
}

interface PrintWarning {
  description: string;
  issues: PrintIssue[];
  title: string;
}

interface ChatMessage {
  content: string;
  id: number;
  hasPrintIssue?: boolean;
  printWarning?: PrintWarning;
  role: MessageRole;
}

const MOCK_PRINT_WARNING: PrintWarning = {
  title: "이대로는 출력할 수 없어요",
  description: "모델은 만들어졌지만 아래 항목이 프린터 규격을 벗어났어요.",
  issues: [
    { label: "벽 두께", current: "0.8 mm", required: "최소 1.2 mm 필요" },
    {
      label: "손잡이 기둥 지름",
      current: "1.4 mm",
      required: "최소 2 mm 필요",
    },
  ],
};

const NORMALIZED_MOCK_RESPONSE =
  "규격에 맞게 모델을 자동 수정했어요. 이제 출력할 수 있습니다.";

interface DesignVersion {
  description: string;
  id: string;
  label: string;
  meta: string;
  stlUrl: string;
}

interface ChatHistory {
  id: string;
  title: string;
}

interface AttachedImage {
  name: string;
  url: string;
}

const INITIAL_CHAT_HISTORIES: ChatHistory[] = [
  { id: "pencil-holder", title: "육각형 연필꽂이" },
  { id: "cable-clip", title: "케이블 정리 클립" },
  { id: "monitor-stand", title: "책상 모니터 받침대" },
  { id: "plant-tray", title: "화분 받침 트레이" },
];

const MOCK_VERSIONS: DesignVersion[] = [
  {
    id: "v1",
    label: "v1",
    description: "육각형 연필꽂이 생성",
    meta: "5분 전",
    stlUrl: "/pencil-holder.stl",
  },
  {
    id: "v2",
    label: "v2",
    description: "바닥 지름 15mm 넓힘",
    meta: "2분 전",
    stlUrl: "/pencil-holder.stl",
  },
  {
    id: "v3",
    label: "v3",
    description: "안쪽을 체스 칸으로 나눔",
    meta: "방금",
    stlUrl: "/pencil-holder.stl",
  },
];

export default function CreateWorkspaceEntry() {
  const router = useRouter();
  const { isLoggedIn } = useAuth();
  const isMounted = useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  );

  const handleAuthModalClose = () => {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/");
  };

  if (!isMounted || !isLoggedIn) {
    return (
      <>
        <Header />
        <LoginRequiredModal
          isOpen={isMounted && !isLoggedIn}
          onClose={handleAuthModalClose}
        />
      </>
    );
  }

  return <CreateWorkspace />;
}

function CreateWorkspace() {
  const [draft, setDraft] = useState("");
  const [attachedImage, setAttachedImage] = useState<AttachedImage | null>(null);
  const selectedFileName = attachedImage ? attachedImage.name : null;
  const [editingHistoryId, setEditingHistoryId] = useState<string | null>(null);
  const [editingHistoryTitle, setEditingHistoryTitle] = useState("");
  const [chatHistories, setChatHistories] = useState(INITIAL_CHAT_HISTORIES);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const [isPrintBlocked, setIsPrintBlocked] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState("v3");
  const [versions, setVersions] = useState<DesignVersion[]>([]);
  const [cameraDistance, setCameraDistance] = useState(42);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const draftTextareaRef = useRef<HTMLTextAreaElement>(null);
  const historyTitleInputRef = useRef<HTMLInputElement>(null);
  const isCancelingHistoryEditRef = useRef(false);

  const selectedVersion =
    versions.find((version) => version.id === selectedVersionId) ?? MOCK_VERSIONS[2];

  useEffect(() => {
    if (editingHistoryId) {
      historyTitleInputRef.current?.focus();
      historyTitleInputRef.current?.select();
    }
  }, [editingHistoryId]);

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

  const appendMockResponse = (userContent: string, prompt: string) => {
    const hasPrintIssue = ["얇게", "최대한 얇게", "얇은"].some((keyword) =>
      prompt.includes(keyword),
    );
    const timestamp = Date.now();

    setMessages((currentMessages) => [
      ...currentMessages,
      { id: timestamp, role: "user", content: userContent },
      hasPrintIssue
        ? {
            id: timestamp + 1,
            role: "assistant",
            content: MOCK_PRINT_WARNING.title,
            hasPrintIssue: true,
            printWarning: MOCK_PRINT_WARNING,
          }
        : {
            id: timestamp + 1,
            role: "assistant",
            content:
              "육각형 연필꽂이를 생성했어요. 높이와 바닥 지름을 조정하면서 원하는 형태로 다듬어 보세요.",
          },
    ]);
    setVersions(MOCK_VERSIONS);
    setSelectedVersionId("v3");
    setIsGenerated(true);
    setIsPrintBlocked(hasPrintIssue);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

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

  const handleAutoFix = () => {
    const timestamp = Date.now();

    setMessages((currentMessages) => [
      ...currentMessages,
      { id: timestamp, role: "user", content: "규격에 맞게 수정해줘" },
      {
        id: timestamp + 1,
        role: "assistant",
        content: NORMALIZED_MOCK_RESPONSE,
      },
    ]);
    setIsPrintBlocked(false);
    setVersions(MOCK_VERSIONS);
    setSelectedVersionId("v3");
    setIsGenerated(true);
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
    setDraft("");
    setEditingHistoryId(null);
    setIsGenerated(false);
    setIsPrintBlocked(false);
    setMessages([]);
    setAttachedImage(null);
    setSelectedVersionId("v3");
    setVersions([]);
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
            {isHistoryOpen && (
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
              selectedVersion={selectedVersion}
              onZoom={handleZoom}
            />
          </section>

          <VersionHistory
            isGenerated={isGenerated}
            selectedVersionId={selectedVersionId}
            setSelectedVersionId={setSelectedVersionId}
            versions={versions}
          />
        </div>

        {isHistoryOpen && (
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
    </>
  );
}

interface ChatPanelProps {
  attachedImage: AttachedImage | null;
  draft: string;
  draftTextareaRef: React.RefObject<HTMLTextAreaElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  isGenerated: boolean;
  messages: ChatMessage[];
  onAutoFix: () => void;
  onDraftChange: (value: string) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onInputKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  onRemoveAttachment: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onToggleHistory: () => void;
}

function ChatPanel({
  attachedImage,
  draft,
  draftTextareaRef,
  fileInputRef,
  isGenerated,
  messages,
  onAutoFix,
  onDraftChange,
  onFileChange,
  onInputKeyDown,
  onPaste,
  onRemoveAttachment,
  onSubmit,
  onToggleHistory,
}: ChatPanelProps) {
  return (
    <section className="relative flex min-h-[720px] min-w-0 flex-col border-r border-gray-200 bg-white px-6 pb-[52px] pt-20 xl:min-h-0 xl:px-[60px]">
      <button
        type="button"
        onClick={onToggleHistory}
        aria-label="대화 메뉴 열기"
        title="대화 메뉴"
        className="absolute left-6 top-6 flex h-12 w-12 items-center justify-center rounded-lg border border-gray-300 text-gray-950 transition-colors hover:bg-gray-50"
      >
        <Menu className="h-6 w-6" aria-hidden="true" />
      </button>

      <div
        className={[
          "mx-auto flex min-h-0 w-full max-w-[480px] flex-1 flex-col",
          isGenerated ? "overflow-hidden" : "justify-end pb-8",
        ].join(" ")}
      >
        {isGenerated ? (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-6 pr-1 pt-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
              >
                {message.hasPrintIssue && message.printWarning ? (
                  <PrintWarningCard warning={message.printWarning} onAutoFix={onAutoFix} />
                ) : (
                  <p
                    className={[
                      "max-w-[88%] whitespace-pre-line rounded-2xl px-4 py-3 text-sm leading-6",
                      message.role === "user"
                        ? "rounded-br-md bg-[#5a7bff] text-white"
                        : "rounded-bl-md border border-gray-200 bg-white text-gray-950",
                    ].join(" ")}
                  >
                    {message.content}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-1 items-end justify-center pb-3">
            <h1 className="text-center text-xl font-medium text-gray-950">
              오늘은 어떤 디자인을 생성할까요?
            </h1>
          </div>
        )}

        <form onSubmit={onSubmit} className="w-full">
          <div className="flex min-h-[60px] flex-col rounded-xl border border-[#5a7bff] bg-white px-4 py-2 shadow-sm">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onFileChange}
              className="sr-only"
            />
            {attachedImage && (
              <div className="group relative mb-3 h-24 w-24 overflow-hidden rounded-lg bg-gray-200">
                <Image
                  src={attachedImage.url}
                  alt="첨부 이미지 미리보기"
                  width={96}
                  height={96}
                  unoptimized
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={onRemoveAttachment}
                  aria-label="첨부 이미지 삭제"
                  title="첨부 이미지 삭제"
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            )}
            <div className="flex min-h-10 items-end gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="참고 이미지 첨부"
                title="참고 이미지 첨부"
                className="py-2 shrink-0 text-gray-950 transition-colors hover:text-[#5a7bff]"
              >
                <Plus className="h-7 w-7" strokeWidth={1.8} aria-hidden="true" />
              </button>
              <textarea
                ref={draftTextareaRef}
                value={draft}
                onChange={(event) => onDraftChange(event.target.value)}
                onKeyDown={onInputKeyDown}
                onPaste={onPaste}
                rows={1}
                placeholder="메시지를 입력해 주세요."
                aria-label="디자인 생성 메시지"
                className="max-h-[200px] min-h-10 flex-1 resize-none overflow-hidden border-0 bg-transparent py-2 text-sm text-gray-950 outline-none placeholder:text-gray-400"
              />
              <button
                type="submit"
                aria-label="메시지 전송"
                title="메시지 전송"
                className="py-2 shrink-0 text-gray-950 transition-colors hover:text-[#5a7bff]"
              >
                <CornerDownLeft className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
              </button>
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-gray-400">
            참고 이미지가 자세할수록 원하는 결과물에 가깝게 만들어져요
          </p>
        </form>
      </div>
    </section>
  );
}

interface HistorySidebarProps {
  chatHistories: ChatHistory[];
  editingHistoryId: string | null;
  editingHistoryTitle: string;
  historyTitleInputRef: React.RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onEditTitle: (history: ChatHistory) => void;
  onNewChat: () => void;
  onSaveTitle: () => void;
  onTitleChange: (value: string) => void;
  onTitleKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}

function HistorySidebar({
  chatHistories,
  editingHistoryId,
  editingHistoryTitle,
  historyTitleInputRef,
  onClose,
  onEditTitle,
  onNewChat,
  onSaveTitle,
  onTitleChange,
  onTitleKeyDown,
}: HistorySidebarProps) {
  return (
    <aside className="flex h-full w-full flex-col rounded-r-2xl bg-white px-5 py-6 shadow-lg">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-950">채팅</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="채팅 히스토리 닫기"
          title="닫기"
          className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-950"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <button
        type="button"
        onClick={onNewChat}
        className="mt-6 flex h-11 items-center justify-center gap-2 rounded-lg bg-[#5a7bff] text-sm font-semibold text-white transition-colors hover:bg-[#4a6ee5]"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        새 채팅
      </button>

      <p className="mt-8 text-xs font-semibold text-gray-400">이전 채팅</p>
      <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto">
        {chatHistories.map((history) => {
          const isEditing = editingHistoryId === history.id;

          return (
            <div
              key={history.id}
              role="button"
              tabIndex={0}
              onDoubleClick={() => onEditTitle(history)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !isEditing) {
                  onEditTitle(history);
                }
              }}
              className="rounded-lg px-3 py-3 text-sm text-gray-700 transition-colors hover:bg-gray-50"
            >
              {isEditing ? (
                <input
                  ref={historyTitleInputRef}
                  value={editingHistoryTitle}
                  onChange={(event) => onTitleChange(event.target.value)}
                  onBlur={onSaveTitle}
                  onKeyDown={onTitleKeyDown}
                  aria-label="채팅 제목 수정"
                  className="w-full rounded border border-[#5a7bff] bg-white px-2 py-1 text-sm text-gray-950 outline-none"
                />
              ) : (
                <span className="block truncate">{history.title}</span>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

interface PrintWarningCardProps {
  onAutoFix: () => void;
  warning: PrintWarning;
}

function PrintWarningCard({ onAutoFix, warning }: PrintWarningCardProps) {
  return (
    <div className="max-w-[92%] rounded-2xl border border-red-400 bg-white p-4 text-gray-950">
      <div className="flex items-center gap-2 text-sm font-semibold text-red-500">
        <span aria-hidden="true" className="text-base leading-none">
          ●
        </span>
        {warning.title}
      </div>
      <p className="mt-4 text-xs leading-5 text-gray-500">{warning.description}</p>
      <div className="mt-3 rounded-xl bg-gray-50 px-4 py-3">
        {warning.issues.map((issue, index) => (
          <div
            key={issue.label}
            className={index < warning.issues.length - 1 ? "mb-3" : ""}
          >
            <p className="text-xs text-gray-500">{issue.label}</p>
            <p className="mt-1 text-sm font-semibold text-gray-950">
              {issue.current}
              <span className="px-2 text-gray-400">→</span>
              {issue.required}
            </p>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onAutoFix}
        className="mt-3 h-11 w-full rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-950 transition-colors hover:bg-gray-50"
      >
        규격에 맞게 자동 수정
      </button>
    </div>
  );
}

interface PreviewPanelProps {
  cameraDistance: number;
  isGenerated: boolean;
  isPrintBlocked: boolean;
  onZoom: (direction: "in" | "out") => void;
  selectedVersion: DesignVersion;
}

function PreviewPanel({
  cameraDistance,
  isGenerated,
  isPrintBlocked,
  onZoom,
  selectedVersion,
}: PreviewPanelProps) {
  return (
    <section className="flex min-h-[720px] min-w-0 flex-col items-center bg-white px-6 pb-8 pt-20 lg:pt-[120px] xl:min-h-0">
      <div className="relative h-[600px] w-full max-w-[432px]">
        {isGenerated ? (
          <>
            <ArtworkModelPreview
              cameraDistance={cameraDistance}
              url={selectedVersion.stlUrl}
              variant="create"
            />
            <div className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white px-4 py-2 text-xs text-gray-500 shadow-md ring-1 ring-black/[0.04]">
              <Move3d className="h-4 w-4 text-gray-950" aria-hidden="true" />
              드래그해서 돌려보세요
            </div>
            <div className="absolute bottom-4 right-4 flex flex-col overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-black/[0.06]">
              <button
                type="button"
                onClick={() => onZoom("in")}
                aria-label="확대"
                title="확대"
                className="flex h-10 w-10 items-center justify-center text-gray-950 transition-colors hover:bg-gray-50"
              >
                <Plus className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onZoom("out")}
                aria-label="축소"
                title="축소"
                className="flex h-10 w-10 items-center justify-center border-t border-gray-100 text-gray-950 transition-colors hover:bg-gray-50"
              >
                <Minus className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-[28px] bg-[#f6f6f6]">
            <PistonLogo height={24} />
          </div>
        )}
      </div>

      <div className="mt-5 grid w-full max-w-[432px] grid-cols-[minmax(0,1fr)_48px] gap-7">
        <button
          type="button"
          disabled={!isGenerated || isPrintBlocked}
          className="h-12 rounded-lg bg-[#5a7bff] text-sm font-semibold text-white transition-colors hover:bg-[#4a6ee5] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-white"
        >
          {isGenerated ? "출력하기" : "디자인을 생성해 주세요."}
        </button>
        {isGenerated ? (
          <a
            href={selectedVersion.stlUrl}
            download
            aria-label="3D 모델 다운로드"
            title="3D 모델 다운로드"
            className="flex h-12 w-12 items-center justify-center rounded-lg border border-gray-200 text-[#5a7bff] transition-colors hover:bg-gray-50"
          >
            <Download className="h-5 w-5" aria-hidden="true" />
          </a>
        ) : (
          <button
            type="button"
            disabled
            aria-label="3D 모델 다운로드 비활성화"
            title="디자인 생성 후 다운로드할 수 있어요"
            className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-300 text-white"
          >
            <Download className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>
      <p className="mt-4 max-w-[432px] text-center text-xs leading-5 text-gray-400">
        생성한 디자인은 기본으로 비공개예요.
        <br />
        Feed에 올리려면 마이페이지에서 공개로 바꿔 주세요.
      </p>
    </section>
  );
}

interface VersionHistoryProps {
  isGenerated: boolean;
  selectedVersionId: string;
  setSelectedVersionId: (versionId: string) => void;
  versions: DesignVersion[];
}

function VersionHistory({
  isGenerated,
  selectedVersionId,
  setSelectedVersionId,
  versions,
}: VersionHistoryProps) {
  return (
    <aside className="min-h-[420px] border-l border-gray-200 bg-white px-5 py-7 xl:min-h-0">
      <h2 className="text-sm font-bold text-gray-950">버전</h2>
      {!isGenerated ? (
        <p className="mt-4 text-xs leading-5 text-gray-400">
          아직 기록이 없어요. 디자인을 만들면 여기에 쌓여요.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {[...versions].reverse().map((version) => {
            const isSelected = selectedVersionId === version.id;

            return (
              <button
                key={version.id}
                type="button"
                onClick={() => setSelectedVersionId(version.id)}
                className={[
                  "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                  isSelected
                    ? "border-transparent bg-[#eef2ff]"
                    : "border-gray-200 bg-white hover:bg-gray-50",
                ].join(" ")}
              >
                <span className="mt-0.5 h-10 w-10 shrink-0 rounded-lg bg-gray-50" />
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-gray-950">{version.label}</span>
                  <span className="mt-1 block text-xs leading-4 text-gray-500">
                    {version.description}
                  </span>
                  <span className="mt-1 block text-[11px] text-gray-400">{version.meta}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
      {isGenerated && (
        <p className="mt-6 flex items-center gap-2 text-xs text-gray-400">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          수정할 때마다 자동으로 저장돼요.
        </p>
      )}
    </aside>
  );
}
