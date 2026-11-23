"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent } from "react";
import { PistonLogo } from "@/shared/ui";
import { Header } from "@/widgets/header";
import {
  canRecheckCreateApiTask,
  canSubmitCreateApiAction,
  createApiGenerationFlow,
  type CreateApiAction,
  type CreateApiState,
  type CreateApiTransport,
  type GetVerifiedCreateAccountScope,
} from "../model/create-api-generation-flow";

const stoppedMessages = {
  paused: "상태 조회를 중단했습니다. 서버에서 모델 생성이 계속될 수 있습니다.",
  "registration-pending": "기존 작업의 상태를 아직 확인할 수 없습니다. 같은 작업의 상태를 다시 조회할 수 있습니다.",
  "not-found": "서버에서 작업을 찾을 수 없습니다. 새 요청을 보내기 전에 이전 작업을 확인해 주세요.",
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
        : { role: "status", text: "3D 모델 생성이 완료되었습니다. 미리보기와 출력은 아직 지원되지 않습니다." };
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
  /** A stable opaque namespace supplied by authenticated integration. */
  requestScope?: string;
  getVerifiedAccountScope?: GetVerifiedCreateAccountScope;
}

export function ApiCreateWorkspace(props: ApiCreateWorkspaceProps) {
  return <ScopedApiCreateWorkspace key={props.requestScope} {...props} />;
}

function ScopedApiCreateWorkspace({ transport, requestScope, getVerifiedAccountScope }: ApiCreateWorkspaceProps) {
  const [flow] = useState(() => createApiGenerationFlow(transport, requestScope));
  const state = useSyncExternalStore(flow.subscribe, flow.getSnapshot, flow.getSnapshot);
  const [kind, setKind] = useState<CreateApiAction["kind"] | null>(null);
  const [draft, setDraft] = useState("");
  const [image, setImage] = useState<File>();
  const [inputError, setInputError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const feedback = describeState(state);
  const busy = state.phase === "submitting" || state.phase === "pending" || state.phase === "waiting-to-resume";
  const submissionEnabled = !!transport && canSubmitCreateApiAction(state);
  const reply = state.phase === "succeeded" && "reply" in state.result ? state.result.reply : null;

  useLayoutEffect(() => {
    flow.setAccountVerifier(getVerifiedAccountScope);
    return () => flow.setAccountVerifier(undefined);
  }, [flow, getVerifiedAccountScope]);

  useEffect(() => {
    flow.restore();
    return flow.stop;
  }, [flow]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!submissionEnabled || kind === null) return;
    const text = draft.trim();

    if (kind === "image") {
      if (!image || text) {
        setInputError("이미지로 3D 모델을 생성하려면 이미지 한 장만 첨부해 주세요.");
        return;
      }
      flow.submit({ kind, image });
    } else {
      if (!text || (kind === "text" && image)) {
        setInputError(kind === "text" ? "텍스트로 3D 모델을 생성하려면 설명만 입력해 주세요." : "채팅 메시지를 입력해 주세요.");
        return;
      }
      flow.submit(kind === "chat" ? { kind, message: text, image } : { kind, prompt: text });
    }
    setInputError("");
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (!event.repeat && submissionEnabled && kind !== null) event.currentTarget.form?.requestSubmit();
  }

  function handleNewChat() {
    flow.reset();
    setKind(null);
    setDraft("");
    setImage(undefined);
    setInputError("");
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <>
      <Header />
      <main lang="ko" className="grid w-full max-w-[1440px] grow gap-8 self-center px-4 py-8 sm:px-8 lg:grid-cols-2 lg:px-12">
        <section className="min-w-0 space-y-4" aria-labelledby="create-api-title">
          <h1 id="create-api-title" className="text-xl font-semibold text-gray-950">3D 디자인 생성</h1>
          {transport ? (
            <>
              <form onSubmit={handleSubmit}>
                <fieldset disabled={!submissionEnabled} className="grid gap-3">
                  <label className="grid gap-1 text-sm font-medium">
                    작업 종류
                    <select
                      value={kind ?? ""}
                      required
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        setKind(value === "chat" || value === "text" || value === "image" ? value : null);
                        setInputError("");
                      }}
                      className="rounded-lg border border-gray-300 px-3 py-2"
                    >
                      <option value="">작업을 선택해 주세요</option>
                      <option value="chat">채팅</option>
                      <option value="text">텍스트로 3D 생성</option>
                      <option value="image">이미지로 3D 생성</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm font-medium">
                    메시지 또는 디자인 설명
                    <textarea
                      value={draft}
                      onChange={(event) => { setDraft(event.currentTarget.value); setInputError(""); }}
                      onKeyDown={handleComposerKeyDown}
                      rows={3}
                      className="rounded-lg border border-gray-300 px-3 py-2"
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-medium">
                    참고 이미지 1장
                    <input
                      ref={fileInput}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) => { setImage(event.currentTarget.files?.[0]); setInputError(""); }}
                      className="max-w-full text-sm"
                    />
                  </label>
                  {image && (
                    <button type="button" className="justify-self-start text-sm text-blue-700 underline" onClick={() => {
                      setImage(undefined);
                      setInputError("");
                      if (fileInput.current) fileInput.current.value = "";
                    }}>첨부 이미지 제거</button>
                  )}
                  <button type="submit" disabled={!submissionEnabled || kind === null} className="justify-self-start rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:bg-gray-100 disabled:text-gray-600">
                    제출
                  </button>
                </fieldset>
              </form>
              {inputError && <p role="alert" className="text-sm text-red-700">{inputError}</p>}
              <div className="flex flex-wrap gap-4 text-sm font-medium text-blue-700">
                {busy && <button type="button" onClick={flow.stop} className="underline">응답 대기 중단</button>}
                {canRecheckCreateApiTask(state) && (
                  <button type="button" onClick={flow.recheck} className="underline">
                    {state.phase === "observing-stopped" && state.reason === "reauth-required"
                      ? "재인증 후 상태 다시 조회" : "상태 다시 조회"}
                  </button>
                )}
                {state.phase !== "idle" && <button type="button" onClick={handleNewChat} className="underline">새 대화</button>}
              </div>
              {feedback && <p role={feedback.role} className={feedback.role === "alert" ? "text-sm text-red-700" : "text-sm text-gray-700"}>{feedback.text}</p>}
              {reply && <p className="break-words whitespace-pre-wrap rounded-xl border border-gray-200 p-4 text-sm">{reply}</p>}
            </>
          ) : (
            <p role="status" className="rounded-xl bg-blue-50 p-4 text-sm text-blue-950">
              실제 채팅 및 3D 생성 연동을 준비 중입니다. 인증 연동이 완료되면 사용할 수 있습니다.
            </p>
          )}
        </section>
        <section aria-label="3D 미리보기" className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-[28px] bg-[#f6f6f6] p-6 text-center">
          <PistonLogo height={24} />
          <p className="text-sm text-gray-600">3D 미리보기와 출력은 아직 지원되지 않습니다.</p>
        </section>
      </main>
    </>
  );
}
