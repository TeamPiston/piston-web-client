import { createContext, type Dispatch, type SetStateAction } from "react";
import type { Printer } from "@/shared/mock/mock-data";

export type PrintStatus = "COMPLETED" | "EMPTY" | "PRINTING";

export interface PrintJob {
  colorMode: string;
  printerId: string;
  stlUrl: string;
  title: string;
}

export interface PrinterContextValue {
  printers: Printer[];
  setPrinters: Dispatch<SetStateAction<Printer[]>>;
  connectedPrinter: Printer | null;
  isPrinterConnected: boolean;
  printStatus: PrintStatus;
  setPrintStatus: Dispatch<SetStateAction<PrintStatus>>;
  printJob: PrintJob | null;
  startPrint: (job: PrintJob) => boolean;
}

export const PrinterContext = createContext<PrinterContextValue | null>(null);
