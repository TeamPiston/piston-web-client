"use client";

import {
  Component, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore,
  type FormEvent, type KeyboardEvent, type ReactNode,
} from "react";
import { Header } from "@/widgets/header";
import { clearStlModel } from "@/features/stl-viewer";
import {
  canRecheckCreateApiTask,
  canSubmitCreateApiAction,
  createApiGenerationFlow,
  type CreateApiAction,
  type CreateApiState,
  type CreateApiTransport,
  type GetVerifiedCreateAccountScope,
} from "../model/create-api-generation-flow";
import { bindCreateApi, getCreateAccountScope } from "../model/create-api-session";
import type { ChatMessage, DesignVersion } from "../model/types";
import { useCreateAttachments } from "../model/use-create-attachments";
import { useCreateChatHistory, type GetCreateHistory } from "../model/use-create-chat-history";
import { ChatPanel } from "./components/chat-panel";
import { PreviewPanel } from "./components/preview-panel";
import { VersionHistory } from "./components/version-history";

const stoppedMessages = {
  paused: "상태 조회를 중단했습니다. 서버에서 모델 생성이 계속될 수 있습니다.",
  "registration-pending": "기존 작업의 상태를 아직 확인할 수 없습니다. 같은 작업의 상태를 다시 조회할 수 있습니다.",
  "not-found": "서버에서 작업을 찾을 수 없습니다. 작업이 만료됐거나 조회할 수 없는 상태일 수 있어요. 같은 작업을 다시 조회할 수 있으며, 확인 전에는 새 모델 생성이 제한됩니다.",
  "access-denied": "이 작업의 조회 권한을 확인할 수 없습니다. 새 생성 요청은 제한됩니다.",
  "reauth-required": "인증이 만료되었습니다. 같은 계정으로 다시 로그인한 뒤 기존 작업 상태를 조회해 주세요.",
  "lookup-failed": "상태 조회에 실패했습니다. 서버에서 모델 생성이 계속될 수 있습니다.",
} satisfies Record<Extract<CreateApiState, { phase: "observing-stopped" }>["reason"], string>;

function describeState(state: CreateApiState) {
  switch (state.phase) {
    case "idle":
      return null;
    case "restoring":
      return { role: "status", text: "이 탭의 이전 요청 상태를 확인하는 중입니다." };
    case "storage-unavailable":
      return { role: "alert", text: "이전 요청 기록을 안전하게 확인하거나 저장할 수 없어 새 요청을 제한하고 있습니다." };
    case "submitting":
      return {
        role: "status",
        text: state.kind === "chat" ? "메시지를 보내는 중입니다." : "3D 모델 생성 요청을 보내는 중입니다.",
      };
    case "pending":
      return { role: "status", text: "3D 모델을 생성하는 중입니다." };
    case "waiting-to-resume":
      return { role: "status", text: "이전 상태 조회가 끝나기를 기다리고 있습니다. 종료 후 5초 뒤에 다시 조회합니다." };
    case "succeeded":
      return "reply" in state.result
        ? { role: "status", text: "메시지 답변을 받았습니다." }
        : { role: "status", text: "3D 모델 생성이 완료되었습니다." };
    case "failed":
      return { role: "alert", text: "3D 모델 생성에 실패했습니다." };
    case "observing-stopped":
      return { role: "alert", text: stoppedMessages[state.reason] };
    case "uncertain":
      return { role: "alert", text: "이전 요청이 접수됐는지 확인할 수 없습니다. 서버에서 처리 중일 수 있어 중복을 방지하기 위해 새 요청을 제한하고 있습니다." };
    case "rejected":
      return { role: "alert", text: state.message };
  }
}

interface ApiCreateWorkspaceProps {
  transport?: CreateApiTransport;
  requestScope?: string;
  sessionId?: string;
  getVerifiedAccountScope?: GetVerifiedCreateAccountScope;
  getHistory?: GetCreateHistory;
}

export function AuthenticatedApiCreateWorkspace({ userId, sessionId }: { userId: string; sessionId: string }) {
  const [connection, setConnection] = useState<(ReturnType<typeof bindCreateApi> & { scope: string }) | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    void getCreateAccountScope(userId).then((scope) => {
      if (active) setConnection({ scope, ...bindCreateApi(sessionId, scope) });
    }).catch(() => {
      if (active) setError(true);
    });
    return () => { active = false; };
  }, [sessionId, userId]);

  if (!connection) {
    return (
      <>
        <Header />
        <p role={error ? "alert" : "status"} className="mx-auto py-10 text-sm text-gray-600">
          {error ? "채팅과 모델 생성에 필요한 로그인 세션을 확인하지 못했어요." : "채팅과 모델 생성을 준비하는 중이에요."}
        </p>
      </>
    );
  }
  return <ApiCreateWorkspace {...connection} requestScope={connection.scope} sessionId={sessionId} />;
}

export function ApiCreateWorkspace(props: ApiCreateWorkspaceProps) {
  return <ScopedApiCreateWorkspace key={props.sessionId ?? props.requestScope} {...props} />;
}

class PreviewErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function ScopedApiCreateWorkspace({ transport, requestScope, sessionId, getVerifiedAccountScope, getHistory }: ApiCreateWorkspaceProps) {
  const [chatFlow] = useState(() => createApiGenerationFlow(transport, requestScope, sessionId, "chat"));
  const [meshyFlow] = useState(() => createApiGenerationFlow(transport, requestScope, sessionId, "meshy"));
  const chatState = useSyncExternalStore(chatFlow.subscribe, chatFlow.getSnapshot, chatFlow.getSnapshot);
  const meshyState = useSyncExternalStore(meshyFlow.subscribe, meshyFlow.getSnapshot, meshyFlow.getSnapshot);
  const history = useCreateChatHistory(getHistory);
  const { refreshLatest } = history;
  const attachments = useCreateAttachments();
  const [kind, setKind] = useState<CreateApiAction["kind"] | null>(null);
  const [draft, setDraft] = useState("");
  const [inputError, setInputError] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [receivedReplies, setReceivedReplies] = useState<ChatMessage[]>([]);
  const [models, setModels] = useState<DesignVersion[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [cameraDistance, setCameraDistance] = useState(42);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const chatFeedback = describeState(chatState);
  const meshyFeedback = describeState(meshyState);
  const feedback = [chatFeedback, meshyFeedback?.text === chatFeedback?.text ? null : meshyFeedback];
  const busy = chatState.phase === "submitting" || meshyState.phase === "submitting" ||
    meshyState.phase === "pending" || meshyState.phase === "waiting-to-resume";
  const chatEnabled = !!transport && canSubmitCreateApiAction(chatState);
  const meshyEnabled = !!transport && canSubmitCreateApiAction(meshyState);
  const canSelectAction = !busy && (chatEnabled || meshyEnabled);
  const submissionEnabled = !busy && (kind === "chat" ? chatEnabled : kind ? meshyEnabled : canSelectAction);
  const model = models.find(({ id }) => id === selectedModel);
  const serverIds = new Set(history.chats.map(({ chatId }) => chatId));
  const messages: ChatMessage[] = [
    ...history.chats.map(({ chatId, role, message, imageUrl }): ChatMessage => ({
      id: chatId, role: role === "USER" ? "user" : "assistant",
      content: imageUrl ? message + "\n이미지 첨부" : message,
    })),
    ...receivedReplies.filter(({ id }) => !serverIds.has(id)),
  ];

  useLayoutEffect(() => {
    chatFlow.setAccountVerifier(getVerifiedAccountScope);
    meshyFlow.setAccountVerifier(getVerifiedAccountScope);
    return () => {
      chatFlow.setAccountVerifier(undefined);
      meshyFlow.setAccountVerifier(undefined);
    };
  }, [chatFlow, meshyFlow, getVerifiedAccountScope]);

  useEffect(() => {
    const unsubscribeChat = chatFlow.subscribe(() => {
      const next = chatFlow.getSnapshot();
      if (next.phase !== "succeeded" || !("reply" in next.result)) return;
      const { chatId, reply } = next.result;
      // POST identifies only the assistant row. Let GET supply the canonical user message.
      setReceivedReplies((previous) => [...previous.filter(({ id }) => id !== chatId), {
        id: chatId, role: "assistant", content: reply,
      }]);
      refreshLatest();
    });
    const unsubscribeMeshy = meshyFlow.subscribe(() => {
      const next = meshyFlow.getSnapshot();
      if (next.phase !== "succeeded" || !("modelUrl" in next.result)) return;
      const { taskId, modelUrl } = next.result;
      setModels((previous) => previous.some(({ id }) => id === taskId) ? previous : [...previous, {
        id: taskId, label: "버전 " + (previous.length + 1), description: "생성된 STL 모델", meta: "", stlUrl: modelUrl,
      }]);
      setSelectedModel(taskId);
      setCameraDistance(42);
    });
    chatFlow.restore();
    meshyFlow.restore();
    return () => {
      unsubscribeChat();
      unsubscribeMeshy();
      chatFlow.stop();
      meshyFlow.stop();
    };
  }, [chatFlow, meshyFlow, refreshLatest]);

  useEffect(() => {
    const input = textarea.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 200) + "px";
    input.style.overflowY = input.scrollHeight > 200 ? "auto" : "hidden";
  }, [draft]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!submissionEnabled || !kind) return;
    const text = draft.trim();
    const image = attachments.attachedImages[0]?.file;
    let action: CreateApiAction;
    if (kind === "image") {
      if (!image || text) {
        setInputError("이미지로 3D 모델을 생성하려면 이미지 한 장만 첨부해 주세요.");
        return;
      }
      action = { kind, image };
    } else {
      if (!text || (kind === "text" && image)) {
        setInputError(kind === "text" ? "텍스트로 3D 모델을 생성하려면 설명만 입력해 주세요." : "채팅 메시지를 입력해 주세요.");
        return;
      }
      action = kind === "chat" ? { kind, message: text, image } : { kind, prompt: text };
    }

    const flow = kind === "chat" ? chatFlow : meshyFlow;
    if (!flow.submit(action)) return;
    setInputError("");
    setDraft("");
    attachments.resetAttachments();
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (!event.repeat && submissionEnabled && kind) event.currentTarget.form?.requestSubmit();
  }

  function handleNewChat() {
    chatFlow.reset();
    meshyFlow.reset();
    setKind(null);
    setDraft("");
    setInputError("");
    attachments.resetAttachments();
    setShowHistory(false);
  }

  const historyControls = getHistory && (showHistory || history.loading || history.error) && (
    <div className="mx-auto mb-3 w-full max-w-[480px] shrink-0 text-sm text-gray-600">
      {history.loading ? <p role="status">채팅 기록을 불러오는 중이에요.</p> :
        history.error ? <p role="alert">{history.error}{" "}
          <button type="button" onClick={history.retry} className="text-blue-700 underline">다시 시도</button>
        </p> : history.hasMore ? (
          <button type="button" onClick={history.loadMore} className="text-blue-700 underline">이전 채팅 기록 더 보기</button>
        ) : <p>이전 채팅 기록이 더 이상 없어요.</p>}
    </div>
  );

  const composerControls = (
    <label className="flex flex-wrap items-center gap-2 text-xs font-medium text-gray-700">
      작업 종류
      <select
        value={kind ?? ""}
        className="rounded-lg border border-gray-300 px-2 py-1"
        onChange={(event) => {
          const value = event.currentTarget.value;
          setKind(value === "chat" || value === "text" || value === "image" ? value : null);
          setInputError("");
        }}
      >
        <option value="">작업을 선택해 주세요</option>
        <option value="chat">채팅</option>
        <option value="text">텍스트로 3D 생성</option>
        <option value="image">이미지로 3D 생성</option>
      </select>
    </label>
  );

  const status = (
    <div className="mb-2 space-y-1.5 text-sm">
      {inputError && <p role="alert" className="text-red-700">{inputError}</p>}
      {feedback.map((item) => item && (
        <p key={item.text} role={item.role} className={item.role === "alert" ? "text-red-700" : "text-gray-700"}>{item.text}</p>
      ))}
      <div className="flex flex-wrap gap-3 text-blue-700">
        {busy && <button type="button" onClick={() => { chatFlow.stop(); meshyFlow.stop(); }} className="underline">응답 대기 중단</button>}
        {canRecheckCreateApiTask(meshyState) && (
          <button type="button" onClick={meshyFlow.recheck} className="underline">
            {meshyState.phase === "observing-stopped" && meshyState.reason === "reauth-required"
              ? "재인증 후 상태 다시 조회" : "상태 다시 조회"}
          </button>
        )}
        {(chatState.phase !== "idle" || meshyState.phase !== "idle") && <button type="button" onClick={handleNewChat} className="underline">입력 초기화</button>}
      </div>
    </div>
  );

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1920px] flex-col overflow-x-clip bg-white xl:h-dvh xl:min-h-0 xl:overflow-x-hidden xl:overflow-y-auto">
      <Header />
      <main className="relative min-h-[calc(100dvh-var(--header-height))] w-full flex-1 bg-white xl:h-[calc(100dvh-var(--header-height))] xl:min-h-[720px] xl:flex-none xl:overflow-hidden">
        <div className="grid min-h-[calc(100dvh-var(--header-height))] xl:h-full xl:min-h-0 xl:grid-cols-[280px_minmax(0,1fr)_280px] xl:grid-rows-[minmax(0,1fr)] 2xl:grid-cols-[360px_minmax(0,1fr)_360px]">
          <aside aria-hidden="true" className="relative hidden min-h-0 border-r border-gray-200 bg-white xl:block" />
          <section className="grid min-h-[calc(100dvh-var(--header-height))] min-w-0 lg:grid-cols-2 xl:min-h-0 xl:grid-rows-[minmax(0,1fr)]">
            <ChatPanel
              {...attachments}
              draft={draft}
              draftTextareaRef={textarea}
              isGenerated={!!model}
              isLoading={busy}
              showLoadingCard={false}
              isPrintBlocked={false}
              messages={messages}
              historyControls={historyControls}
              composerControls={composerControls}
              composerControlsDisabled={!canSelectAction}
              feedback={status}
              submissionDisabled={!submissionEnabled}
              onDraftChange={(value) => { setDraft(value); setInputError(""); attachments.clearAttachmentError(); }}
              onDrop={(event) => submissionEnabled ? attachments.handleDrop(event) : event.preventDefault()}
              onDragOver={attachments.handleDragOver}
              onFileChange={attachments.handleFileChange}
              onInputKeyDown={handleComposerKeyDown}
              onPaste={attachments.handlePaste}
              onRemoveAttachment={attachments.handleRemoveAttachment}
              onSubmit={handleSubmit}
              onToggleHistory={() => setShowHistory(!showHistory)}
            />
            <PreviewErrorBoundary key={model?.id + ":" + previewAttempt} fallback={(
              <section className="flex min-h-[720px] flex-col items-center justify-center gap-3 px-6 text-center">
                <p role="alert">STL 미리보기를 불러오지 못했어요.</p>
                {model?.stlUrl && <button
                  type="button" className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
                  onClick={() => {
                    if (!model.stlUrl) return;
                    clearStlModel(model.stlUrl);
                    setPreviewAttempt((current) => current + 1);
                  }}
                >미리보기 다시 시도</button>}
              </section>
            )}>
              <PreviewPanel
                cameraDistance={cameraDistance}
                isGenerated={!!model}
                isPrintBlocked
                isPrintCheckFailed={false}
                isPrintStatusChecking={false}
                modelParams={{ stlUrl: model?.stlUrl ?? "", color: "#9ca3af", scale: [1, 1, 1] }}
                printSuccessPhase="hidden"
                onZoom={(direction) => setCameraDistance((distance) =>
                  direction === "in" ? Math.max(26, distance - 4) : Math.min(70, distance + 4))}
              />
            </PreviewErrorBoundary>
          </section>
          <VersionHistory
            isGenerated={models.length > 0}
            selectedVersionId={selectedModel}
            onSelectVersion={setSelectedModel}
            versions={models}
            showAutosave={false}
          />
        </div>
      </main>
    </div>
  );
}
