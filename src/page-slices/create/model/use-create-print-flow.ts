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
  const printCheckInFlightEpochRef = useRef<number | null>(null);
  const printStartInFlightEpochRef = useRef<number | null>(null);
  const responseEpochRef = useRef(0);
  const isMountedRef = useRef(false);
  const isPrinterConnectedRef = useRef(isPrinterConnected);

  useLayoutEffect(() => {
    isPrinterConnectedRef.current = isPrinterConnected;
  }, [isPrinterConnected]);

  useEffect(() => {
    isMountedRef.current = true;
    setIsPrintStatusChecking(printCheckInFlightEpochRef.current === responseEpochRef.current);
    setIsPrintStarting(printStartInFlightEpochRef.current === responseEpochRef.current);

    return () => {
      isMountedRef.current = false;
      responseEpochRef.current += 1;
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
      isPrintStatusChecking || printCheckInFlightEpochRef.current !== null
    ) {
      return;
    }

    const requestEpoch = responseEpochRef.current;
    printCheckInFlightEpochRef.current = requestEpoch;
    setIsPrintStatusChecking(true);

    void (async () => {
      try {
        const printTask = await getCurrentPrintTask();
        if (!isCurrentResponse(requestEpoch)) {
          return;
        }

        setCurrentPrintTask(printTask);
        setIsPrintCheckFailed(false);

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
        if (!isCurrentResponse(requestEpoch)) {
          return;
        }

        setIsPrintCheckFailed(true);
        setIsPrintModalOpen(false);
        setIsPrintInProgressModalOpen(false);
        setIsPrinterConnectionModalOpen(false);
      } finally {
        printCheckInFlightEpochRef.current = null;
        if (isCurrentResponse(requestEpoch)) {
          setIsPrintStatusChecking(false);
        }
      }
    })();
  };

  const handlePrintConfirm = ({ colorMode }: { colorMode: string }) => {
    if (
      !isMountedRef.current || isPrintStarting || isPrintCheckFailed || isPrintStatusChecking ||
      !isPrintModalOpen || printStartInFlightEpochRef.current !== null
    ) {
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

  const handlePrintModalClose = useCallback(() => {
    setIsPrintModalOpen(false);
  }, []);

  const handlePrinterConnectionModalClose = useCallback(() => {
    setIsPrinterConnectionModalOpen(false);
  }, []);

  const handlePrintInProgressModalClose = () => {
    setIsPrintInProgressModalOpen(false);
  };

  const closePrintSetup = useCallback(() => {
    setIsPrintModalOpen(false);
    setIsPrinterConnectionModalOpen(false);
  }, []);

  const resetPrintFlow = () => {
    responseEpochRef.current += 1;
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
