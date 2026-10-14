"use client";

import { useContext } from "react";
import { PrinterQueryContext } from "./query-context";

export function usePrinterQuery() {
  const context = useContext(PrinterQueryContext);
  if (!context) {
    throw new Error("usePrinterQuery must be used within a PrinterProvider");
  }
  return context;
}
