"use client";

import { useState, type ReactNode } from "react";
import { getPrintersWithFallback, type Printer } from "@/shared/mock/mock-data";
import {
  PrinterContext,
  type PrinterContextValue,
  type PrintJob,
  type PrintStatus,
} from "./context";

export function PrinterProvider({ children, initialPrinters }: {
  children: ReactNode;
  initialPrinters?: Printer[];
}) {
  // TODO: Load registered printers and the current print job from the API.
  const [printers, setPrinters] = useState<Printer[]>(() =>
    getPrintersWithFallback(initialPrinters).map((printer) => ({ ...printer })),
  );
  const [printStatus, setPrintStatus] = useState<PrintStatus>("EMPTY");
  const [printJob, setPrintJob] = useState<PrintJob | null>(null);
  const connectedPrinter = printers.find(
    (printer) => printer.connectionStatus === "connected",
  ) ?? null;

  const startPrint = (job: PrintJob) => {
    if (!printers.some(
      (printer) => printer.id === job.printerId && printer.connectionStatus === "connected",
    )) {
      return false;
    }

    // TODO: Submit the print request and update status only after API success.
    setPrintJob(job);
    setPrintStatus("PRINTING");
    return true;
  };

  const value: PrinterContextValue = {
    printers,
    setPrinters,
    connectedPrinter,
    isPrinterConnected: connectedPrinter !== null,
    printStatus,
    setPrintStatus,
    printJob,
    startPrint,
  };

  return <PrinterContext.Provider value={value}>{children}</PrinterContext.Provider>;
}
