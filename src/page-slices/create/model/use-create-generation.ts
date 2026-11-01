"use client";

import { useEffect, useRef, useState } from "react";
import {
  COPYRIGHT_KEYWORDS,
  MOCK_COPYRIGHT_WARNING,
  MOCK_CORRECTED_VERSION,
  MOCK_PRINT_WARNING,
  MOCK_VERSIONS,
} from "./mock-data";
import { createPrintCorrection, resolveModelParams } from "./model-utils";
import type { ChatMessage, DesignVersion, ResolvedArtworkModelParams } from "./types";

interface GenerationRequest {
  prompt: string;
  userContent: string;
}

interface GenerationTask {
  timeoutId: number | null;
}

export function useCreateGeneration() {
  const [isGenerated, setIsGenerated] = useState(false);
  const [isPrintBlocked, setIsPrintBlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState("v3");
  const [versions, setVersions] = useState<DesignVersion[]>([]);
  const [currentModelParams, setCurrentModelParams] = useState<ResolvedArtworkModelParams>(
    () => resolveModelParams(MOCK_VERSIONS[2]),
  );
  const nextVersionNumberRef = useRef(1);
  const activeGenerationRef = useRef<GenerationTask | null>(null);
  const isMountedRef = useRef(false);
  const autoFixedMessageIdsRef = useRef(new Set<string>());

  useEffect(() => {
    isMountedRef.current = true;
    // Cleanup cancels local work; effect replay must also restore the idle UI.
    setIsLoading(activeGenerationRef.current !== null);

    return () => {
      isMountedRef.current = false;
      const task = activeGenerationRef.current;
      activeGenerationRef.current = null;
      if (task !== null && task.timeoutId !== null) {
        window.clearTimeout(task.timeoutId);
        task.timeoutId = null;
      }
    };
  }, []);

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

  const startGeneration = ({ prompt, userContent }: GenerationRequest): boolean => {
    if (!isMountedRef.current || activeGenerationRef.current !== null || !userContent.trim()) {
      return false;
    }

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
    // Finish synchronous preparation before acquiring the task's lock and timer.
    const task: GenerationTask = { timeoutId: null };
    activeGenerationRef.current = task;
    try {
      task.timeoutId = window.setTimeout(() => {
        // A cancelled or completed callback cannot touch a newer task or its state.
        if (!isMountedRef.current || activeGenerationRef.current !== task) {
          return;
        }

        activeGenerationRef.current = null;
        task.timeoutId = null;
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
    } catch (error) {
      activeGenerationRef.current = null;
      throw error;
    }

    // A failed start must leave chat, loading and Workspace cleanup untouched.
    setMessages((currentMessages) => [...currentMessages, userMessage]);
    setIsLoading(true);
    return true;
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

  const handleVersionSelect = (versionId: string) => {
    const nextVersion = versions.find((version) => version.id === versionId);
    if (!nextVersion) {
      return;
    }

    setSelectedVersionId(nextVersion.id);
    setCurrentModelParams(resolveModelParams(nextVersion));
  };

  const resetGeneration = () => {
    const task = activeGenerationRef.current;
    activeGenerationRef.current = null;
    if (task !== null && task.timeoutId !== null) {
      window.clearTimeout(task.timeoutId);
      task.timeoutId = null;
    }

    setIsGenerated(false);
    setIsPrintBlocked(false);
    setIsLoading(false);
    setMessages([]);
    autoFixedMessageIdsRef.current.clear();
    setSelectedVersionId("v3");
    setVersions([]);
    nextVersionNumberRef.current = 1;
    setCurrentModelParams(resolveModelParams(MOCK_VERSIONS[2]));
  };

  return {
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
  };
}
