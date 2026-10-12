"use client";

import { useContext } from "react";
import { PrinterContext } from "./context";

export function usePrinter() {
  const context = useContext(PrinterContext);
  if (!context) {
    throw new Error("usePrinter must be used within a PrinterProvider");
  }
  return context;
}
