"use client";

import { useState, type ReactNode } from "react";
import {
  getPrintersWithFallback,
  PrinterQueryContext,
  type Printer,
  type PrintJob,
  type PrintStatus,
} from "@/entities/printer";
import { PrinterActionsContext } from "./context";

export function PrinterProvider({ children, initialPrinters }: {
  children: ReactNode;
  initialPrinters?: Printer[];
}) {
  // TODO: Load registered printers and the current print job from the API.
  const [printers, setPrinters] = useState<Printer[]>(() =>
    getPrintersWithFallback(initialPrinters).map((printer) => ({ ...printer })),
  );
  const [{ printStatus, printJob }, setPrintState] = useState<{
    printStatus: PrintStatus;
    printJob: PrintJob | null;
  }>({ printStatus: "EMPTY", printJob: null });
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
    setPrintState({ printJob: job, printStatus: "PRINTING" });
    return true;
  };

  const removePrinter = (printerId: string) => {
    // TODO: Cancel the server-side print and delete the printer before committing local changes.
    // This currently clears only the mock provider state.
    setPrinters((currentPrinters) =>
      currentPrinters.filter((printer) => printer.id !== printerId),
    );
    setPrintState((currentPrint) =>
      currentPrint.printJob?.printerId === printerId
        ? { printJob: null, printStatus: "EMPTY" }
        : currentPrint,
    );
  };

  const query = {
    printers,
    connectedPrinter,
    isPrinterConnected: connectedPrinter !== null,
    printStatus,
    printJob,
  };

  return (
    <PrinterQueryContext.Provider value={query}>
      <PrinterActionsContext.Provider value={{ setPrinters, removePrinter, startPrint }}>
        {children}
      </PrinterActionsContext.Provider>
    </PrinterQueryContext.Provider>
  );
}
