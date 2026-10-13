"use client";

import { CornerDownLeft, Menu, Plus, X } from "lucide-react";
import Image from "next/image";
import type { ChangeEvent, ClipboardEvent, DragEvent, FormEvent, KeyboardEvent } from "react";
import type { AttachedImage, ChatMessage } from "../../model/types";
import {
  AiLoadingCard,
  CopyrightWarningCard,
  PrintCorrectionCard,
  PrintWarningCard,
} from "./chat-message-cards";

interface ChatPanelProps {
  attachedImages: AttachedImage[];
  draft: string;
  draftTextareaRef: React.RefObject<HTMLTextAreaElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  isGenerated: boolean;
  isLoading: boolean;
  isLimitExceeded: boolean;
  isPrintBlocked: boolean;
  messages: ChatMessage[];
  onAutoFix: (messageId: string) => void;
  onDraftChange: (value: string) => void;
  onDragOver: (event: DragEvent<HTMLFormElement>) => void;
  onDrop: (event: DragEvent<HTMLFormElement>) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onInputKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  onRemoveAttachment: (imageId: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onToggleHistory: () => void;
}

export function ChatPanel({
  attachedImages,
  draft,
  draftTextareaRef,
  fileInputRef,
  isGenerated,
  isLoading,
  isLimitExceeded,
  isPrintBlocked,
  messages,
  onAutoFix,
  onDraftChange,
  onDragOver,
  onDrop,
  onFileChange,
  onInputKeyDown,
  onPaste,
  onRemoveAttachment,
  onSubmit,
  onToggleHistory,
}: ChatPanelProps) {
  const latestPrintWarningId = [...messages].reverse().find((message) => message.hasPrintIssue)?.id;

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
          isGenerated || isLoading || messages.length > 0
            ? "overflow-hidden"
            : "justify-end pb-8",
        ].join(" ")}
      >
        {isGenerated || isLoading || messages.length > 0 ? (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-6 pr-1 pt-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
              >
                {message.isCopyrightIssue && message.copyrightWarning ? (
                  <CopyrightWarningCard warning={message.copyrightWarning} />
                ) : message.printCorrection ? (
                  <PrintCorrectionCard correction={message.printCorrection} />
                ) : message.hasPrintIssue && message.printWarning ? (
                  <PrintWarningCard
                    warning={message.printWarning}
                    isDisabled={
                      isLoading ||
                      !isPrintBlocked ||
                      message.isPrintIssueResolved === true ||
                      message.id !== latestPrintWarningId
                    }
                    onAutoFix={() => onAutoFix(message.id)}
                  />
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
            {isLoading && <AiLoadingCard />}
          </div>
        ) : (
          <div className="flex flex-1 items-end justify-center pb-3">
            <h1 className="text-center text-xl font-medium text-gray-950">
              오늘은 어떤 디자인을 생성할까요?
            </h1>
          </div>
        )}

        <form onSubmit={onSubmit} onDragOver={onDragOver} onDrop={onDrop} className="w-full">
          <div className={[
            "flex min-h-[60px] flex-col rounded-xl bg-white px-4 py-2 shadow-sm",
            isLimitExceeded ? "border-2 border-red-400" : "border border-[#5a7bff]",
          ].join(" ")}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onFileChange}
              className="sr-only"
            />
            {attachedImages.length > 0 && (
              <div className="mb-3 flex gap-2">
                {attachedImages.map((image) => (
                  <div
                    key={image.id}
                    className="group relative h-16 w-16 overflow-hidden rounded-lg bg-gray-200"
                  >
                    <Image
                      src={image.url}
                      alt={`첨부 이미지 미리보기: ${image.name}`}
                      width={64}
                      height={64}
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => onRemoveAttachment(image.id)}
                      aria-label={`${image.name} 첨부 이미지 삭제`}
                      title="첨부 이미지 삭제"
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </div>
                ))}
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
                disabled={isLoading}
                rows={1}
                placeholder="메시지를 입력해 주세요."
                aria-label="디자인 생성 메시지"
                className="max-h-[200px] min-h-10 flex-1 resize-none overflow-hidden border-0 bg-transparent py-2 text-sm text-gray-950 outline-none placeholder:text-gray-400"
              />
              <button
                type="submit"
                disabled={isLoading}
                aria-label="메시지 전송"
                title="메시지 전송"
                className="py-2 shrink-0 text-gray-950 transition-colors hover:text-[#5a7bff] disabled:cursor-not-allowed disabled:text-gray-300"
              >
                <CornerDownLeft className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
              </button>
            </div>
          </div>
          {isLimitExceeded && (
            <p className="mt-2 text-center text-xs text-red-500">
              사진은 최대 2장까지 첨부할 수 있어요
            </p>
          )}
          <p className="mt-3 text-center text-xs text-gray-400">
            참고 이미지가 자세할수록 원하는 결과물에 가깝게 만들어져요
          </p>
        </form>
      </div>
    </section>
  );
}
