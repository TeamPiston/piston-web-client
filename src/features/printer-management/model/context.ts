"use client";

import { createContext, useContext, type Dispatch, type SetStateAction } from "react";
import type { Printer, PrintJob, PrintStatus } from "@/entities/printer";

interface PrinterActions {
  setPrinters: Dispatch<SetStateAction<Printer[]>>;
  setPrintStatus: Dispatch<SetStateAction<PrintStatus>>;
  startPrint: (job: PrintJob) => boolean;
}

export const PrinterActionsContext = createContext<PrinterActions | null>(null);

export function usePrinterActions() {
  const context = useContext(PrinterActionsContext);
  if (!context) {
    throw new Error("usePrinterActions must be used within a PrinterProvider");
  }
  return context;
}
