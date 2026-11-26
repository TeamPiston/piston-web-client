"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type Dispatch, type ReactNode, type SetStateAction } from "react";
import {
  getPrintersWithFallback,
  PrinterQueryContext,
  type Printer,
  type PrintJob,
  type PrintStatus,
} from "@/entities/printer";
import {
  advanceMockPrint,
  clearMockPrintForPrinter,
  createMockPrintTask,
  getCurrentMockPrint,
  hasActiveMockPrint,
  isActiveMockPrint,
  isMockModeEnabled,
  subscribeMockPrint,
} from "@/shared/mock/mock-data";
import { readMockPrinters, saveMockPrinters } from "@/shared/mock/mock-printers";
import { PrinterActionsContext } from "./context";

const noPrint = () => null;
const noSubscription = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function PrinterProvider({ children, initialPrinters }: {
  children: ReactNode;
  initialPrinters?: Printer[];
}) {
  // TODO: Load registered printers and the current print job from the API.
  const isMock = isMockModeEnabled();
  const [defaultPrinters] = useState(() =>
    getPrintersWithFallback(initialPrinters).map((printer) => ({ ...printer })),
  );
  const [tabPrinters, setTabPrinters] = useState(() =>
    (isMock && !initialPrinters ? readMockPrinters() : undefined) ?? defaultPrinters,
  );
  const isClient = useSyncExternalStore(noSubscription, clientReady, serverReady);
  const printers = isClient ? tabPrinters : defaultPrinters;
  const task = useSyncExternalStore(subscribeMockPrint, isMock ? getCurrentMockPrint : noPrint, noPrint);
  const printJob = task?.job ?? null;
  const hasActivePrint = isActiveMockPrint(task);
  const printStatus: PrintStatus = printJob && (task?.status === "PRINTING" || task?.status === "COMPLETED")
    ? task.status
    : "EMPTY";

  const latestPrinters = useRef(tabPrinters);
  const setPrinters: Dispatch<SetStateAction<Printer[]>> = useCallback((update) => {
    const next = typeof update === "function" ? update(latestPrinters.current) : update;
    latestPrinters.current = next;
    if (isMock && !initialPrinters) saveMockPrinters(next);
    setTabPrinters(next);
  }, [initialPrinters, isMock]);

  useEffect(() => {
    if (!hasActivePrint) return;
    const timer = window.setInterval(advanceMockPrint, 3_000);
    advanceMockPrint();
    return () => window.clearInterval(timer);
  }, [hasActivePrint]);
  const connectedPrinter = printers.find(
    (printer) => printer.connectionStatus === "connected",
  ) ?? null;

  const startPrint = useCallback((job: PrintJob) => {
    const printer = printers.find(
      (candidate) => candidate.id === job.printerId && candidate.connectionStatus === "connected",
    );
    if (!isMock || !printer || hasActiveMockPrint()) return false;

    try {
      createMockPrintTask(job.title, { job, printerName: printer.name });
      return true;
    } catch {
      return false;
    }
  }, [isMock, printers]);

  const removePrinter = useCallback((printerId: string) => {
    setPrinters((currentPrinters) =>
      currentPrinters.filter((printer) => printer.id !== printerId),
    );
    if (isMock) clearMockPrintForPrinter(printerId);
  }, [isMock, setPrinters]);

  const actions = useMemo(
    () => ({ setPrinters, removePrinter, startPrint }),
    [setPrinters, removePrinter, startPrint],
  );

  const query = {
    printers,
    connectedPrinter,
    isPrinterConnected: connectedPrinter !== null,
    printStatus,
    printJob,
    hasActivePrint,
  };

  return (
    <PrinterQueryContext.Provider value={query}>
      <PrinterActionsContext.Provider value={actions}>
        {children}
      </PrinterActionsContext.Provider>
    </PrinterQueryContext.Provider>
  );
}
