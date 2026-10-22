"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPrintTask, getCurrentPrintTask, type PrintTask } from "@/entities/print";
import type { PrintSuccessPhase } from "./types";

interface UseCreatePrintFlowOptions {
  isGenerated: boolean;
  isPrintBlocked: boolean;
  isPrinterConnected: boolean;
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
  const [printSuccessPhase, setPrintSuccessPhase] = useState<PrintSuccessPhase>("hidden");
  const isPrintCheckInFlightRef = useRef(false);
  const isPrintStartInFlightRef = useRef(false);

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

  const handlePrintOpen = () => {
    if (!isGenerated || isPrintBlocked || isPrintStatusChecking || isPrintCheckInFlightRef.current) {
      return;
    }

    isPrintCheckInFlightRef.current = true;
    setIsPrintStatusChecking(true);

    void (async () => {
      try {
        const printTask = await getCurrentPrintTask();
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
      } catch {
        setIsPrintCheckFailed(true);
        setIsPrintModalOpen(false);
        setIsPrintInProgressModalOpen(false);
        setIsPrinterConnectionModalOpen(false);
      } finally {
        isPrintCheckInFlightRef.current = false;
        setIsPrintStatusChecking(false);
      }
    })();
  };

  const handlePrintConfirm = ({ colorMode }: { colorMode: string }) => {
    if (
      isPrintStarting || isPrintCheckFailed || isPrintStatusChecking ||
      !isPrintModalOpen || isPrintStartInFlightRef.current
    ) {
      return;
    }

    void colorMode;
    isPrintStartInFlightRef.current = true;
    setIsPrintStarting(true);
    setPrintStartError(null);

    void (async () => {
      try {
        await createPrintTask();
        setIsPrintModalOpen(false);
        setPrintSuccessPhase("visible");
      } catch {
        setPrintStartError("출력 시작에 실패했어요. 잠시 후 다시 시도해 주세요.");
      } finally {
        isPrintStartInFlightRef.current = false;
        setIsPrintStarting(false);
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
    closePrintSetup();
    setIsPrintInProgressModalOpen(false);
    setIsPrintStatusChecking(false);
    setIsPrintCheckFailed(false);
    setIsPrintStarting(false);
    setPrintStartError(null);
    setCurrentPrintTask(null);
    setPrintSuccessPhase("hidden");
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
    printSuccessPhase,
    handlePrintOpen,
    handlePrintConfirm,
    handlePrintModalClose,
    handlePrinterConnectionModalClose,
    handlePrintInProgressModalClose,
    closePrintSetup,
    resetPrintFlow,
  };
}
