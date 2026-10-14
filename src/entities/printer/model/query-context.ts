"use client";

import { createContext } from "react";
import type { Printer, PrintJob, PrintStatus } from "./printer";

export interface PrinterQueryValue {
  readonly printers: readonly Printer[];
  readonly connectedPrinter: Printer | null;
  readonly isPrinterConnected: boolean;
  readonly printStatus: PrintStatus;
  readonly printJob: PrintJob | null;
}

export const PrinterQueryContext = createContext<PrinterQueryValue | null>(null);
