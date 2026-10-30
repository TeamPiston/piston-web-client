"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPrintTask, getCurrentPrintTask, type PrintTask } from "@/entities/print";
import type { PrintSuccessPhase } from "./types";

interface UseCreatePrintFlowOptions {
  isGenerated: boolean;
  isPrintBlocked: boolean;
  isPrinterConnected: boolean;
}

interface PrintSuccessState {
  phase: PrintSuccessPhase;
  notice: { startedAt: number };
}

interface PrintCheckRequest {
  epoch: number;
}

export function useCreatePrintFlow({
  isGenerated,
  isPrintBlocked,
  isPrinterConnected,
}: UseCreatePrintFlowOptions) {
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isPrintInProgressModalOpen, setIsPrintInProgressModalOpen] = useState(false);
  const [isPrintStatusChecking, setIsPrintStatusChecking] = useState(false);
  const [isPrintCheckFailed, setIsPrintCheckFailed] = useState(false);
  const [isPrintStarting, setIsPrintStarting] = useState(false);
  const [printStartError, setPrintStartError] = useState<string | null>(null);
  const [currentPrintTask, setCurrentPrintTask] = useState<PrintTask | null>(null);
  const [isPrinterConnectionModalOpen, setIsPrinterConnectionModalOpen] = useState(false);
  const [printSuccess, setPrintSuccess] = useState<PrintSuccessState | null>(null);
  const successNotice = printSuccess?.notice;
  const activePrintCheckRef = useRef<PrintCheckRequest | null>(null);
  const printStartInFlightEpochRef = useRef<number | null>(null);
  const printStartNeedsRecheckRef = useRef(false);
  const responseEpochRef = useRef(0);
  const isMountedRef = useRef(false);
  const isPrinterConnectedRef = useRef(isPrinterConnected);

  useLayoutEffect(() => {
    isPrinterConnectedRef.current = isPrinterConnected;
  }, [isPrinterConnected]);

  useEffect(() => {
    isMountedRef.current = true;
    setIsPrintStatusChecking(activePrintCheckRef.current !== null);
    setIsPrintStarting(printStartInFlightEpochRef.current === responseEpochRef.current);

    return () => {
      isMountedRef.current = false;
      responseEpochRef.current += 1;
      activePrintCheckRef.current = null;
      if (printStartInFlightEpochRef.current !== null) {
        printStartNeedsRecheckRef.current = true;
      }
    };
  }, []);

  useEffect(() => {
    if (!successNotice) {
      return;
    }

    let active = true;
    const updatePhase = (phase: PrintSuccessPhase) => {
      if (!active) {
        return;
      }

      setPrintSuccess((current) => {
        if (current?.notice !== successNotice) {
          return current;
        }

        return phase === "hidden" ? null : { ...current, phase };
      });
    };
    const elapsed = performance.now() - successNotice.startedAt;
    const fadeTimeoutId = window.setTimeout(() => updatePhase("fading"), Math.max(0, 3500 - elapsed));
    const hideTimeoutId = window.setTimeout(() => updatePhase("hidden"), Math.max(0, 4000 - elapsed));

    return () => {
      active = false;
      window.clearTimeout(fadeTimeoutId);
      window.clearTimeout(hideTimeoutId);
    };
  }, [successNotice]);

  const isCurrentResponse = (requestEpoch: number) => (
    isMountedRef.current && responseEpochRef.current === requestEpoch
  );

  const handlePrintOpen = () => {
    if (
      !isMountedRef.current || !isGenerated || isPrintBlocked ||
      activePrintCheckRef.current !== null
    ) {
      return;
    }

    const request = { epoch: responseEpochRef.current };
    const pendingStart = printStartInFlightEpochRef.current;
    activePrintCheckRef.current = request;
    const isCurrentCheck = () => (
      isCurrentResponse(request.epoch) && activePrintCheckRef.current === request
    );
    setIsPrintStatusChecking(true);

    void (async () => {
      try {
        const printTask = await getCurrentPrintTask();
        if (!isCurrentCheck()) {
          return;
        }

        setCurrentPrintTask(printTask);
        setIsPrintCheckFailed(false);
        // A GET started before an uncertain POST settled cannot authorize a new POST.
        if (pendingStart === null && printStartInFlightEpochRef.current === null) {
          printStartNeedsRecheckRef.current = false;
        }

        if (printTask?.status === "PRINTING") {
          setIsPrintModalOpen(false);
          setIsPrinterConnectionModalOpen(false);
          setIsPrintInProgressModalOpen(true);
          return;
        }

        if (!isPrinterConnectedRef.current) {
          setPrintStartError(null);
          setIsPrintModalOpen(false);
          setIsPrinterConnectionModalOpen(true);
          return;
        }

        setIsPrinterConnectionModalOpen(false);
        setPrintStartError(null);
        setIsPrintModalOpen(true);
      } catch {
        if (!isCurrentCheck()) {
          return;
        }

        setIsPrintCheckFailed(true);
        setIsPrintModalOpen(false);
        setIsPrintInProgressModalOpen(false);
        setIsPrinterConnectionModalOpen(false);
      } finally {
        if (isCurrentCheck()) {
          activePrintCheckRef.current = null;
          setIsPrintStatusChecking(false);
        }
      }
    })();
  };

  const handlePrintConfirm = ({ colorMode }: { colorMode: string }) => {
    if (
      !isMountedRef.current || isPrintStarting || isPrintCheckFailed || isPrintStatusChecking ||
      !isPrintModalOpen
    ) {
      return;
    }

    if (printStartInFlightEpochRef.current !== null && !printStartNeedsRecheckRef.current) {
      return;
    }
    if (printStartNeedsRecheckRef.current) {
      setPrintStartError("이전 출력 요청의 처리 여부를 확인해야 해요. 요청 처리 후 창을 닫고 출력하기를 다시 눌러 주세요.");
      return;
    }

    void colorMode;
    const requestEpoch = responseEpochRef.current;
    printStartInFlightEpochRef.current = requestEpoch;
    setIsPrintStarting(true);
    setPrintStartError(null);

    void (async () => {
      try {
        await createPrintTask();
        if (!isCurrentResponse(requestEpoch)) {
          return;
        }

        setIsPrintModalOpen(false);
        setPrintSuccess({ phase: "visible", notice: { startedAt: performance.now() } });
      } catch {
        if (!isCurrentResponse(requestEpoch)) {
          return;
        }

        setPrintStartError("출력 시작에 실패했어요. 잠시 후 다시 시도해 주세요.");
      } finally {
        printStartInFlightEpochRef.current = null;
        if (isCurrentResponse(requestEpoch)) {
          setIsPrintStarting(false);
        }
      }
    })();
  };

  const invalidatePrintCheck = useCallback(() => {
    activePrintCheckRef.current = null;
    setIsPrintStatusChecking(false);
  }, []);

  const handlePrintModalClose = useCallback(() => {
    invalidatePrintCheck();
    setIsPrintModalOpen(false);
  }, [invalidatePrintCheck]);

  const handlePrinterConnectionModalClose = useCallback(() => {
    invalidatePrintCheck();
    setIsPrinterConnectionModalOpen(false);
  }, [invalidatePrintCheck]);

  const handlePrintInProgressModalClose = () => {
    setIsPrintInProgressModalOpen(false);
  };

  const closePrintSetup = useCallback(() => {
    invalidatePrintCheck();
    setIsPrintModalOpen(false);
    setIsPrinterConnectionModalOpen(false);
  }, [invalidatePrintCheck]);

  const resetPrintFlow = () => {
    responseEpochRef.current += 1;
    if (printStartInFlightEpochRef.current !== null) {
      printStartNeedsRecheckRef.current = true;
    }
    closePrintSetup();
    setIsPrintInProgressModalOpen(false);
    setIsPrintStatusChecking(false);
    setIsPrintCheckFailed(false);
    setIsPrintStarting(false);
    setPrintStartError(null);
    setCurrentPrintTask(null);
    setPrintSuccess(null);
  };

  return {
    isPrintModalOpen,
    isPrintInProgressModalOpen,
    isPrintStatusChecking,
    isPrintCheckFailed,
    isPrintStarting,
    printStartError,
    currentPrintTask,
    isPrinterConnectionModalOpen,
    printSuccessPhase: printSuccess?.phase ?? "hidden",
    handlePrintOpen,
    handlePrintConfirm,
    handlePrintModalClose,
    handlePrinterConnectionModalClose,
    handlePrintInProgressModalClose,
    closePrintSetup,
    resetPrintFlow,
  };
}
