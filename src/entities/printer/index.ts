export { PrinterQueryContext } from "./model/query-context";
export { usePrinterQuery } from "./model/use-printer-query";
export { getPrintersWithFallback } from "./model/mock-printers";
export { PrinterCard } from "./ui/printer-card";
export { PrinterStatusBadge } from "./ui/printer-status-badge";
export type { Printer, PrinterConnectionStatus, PrintJob, PrintStatus } from "./model/printer";
export {
  PRINTER_TYPES, decodeRegisteredPrinter, getPrinter, isPrinterType, isPrinterUrl, listPrinters,
  printerPath, requestPrinter, requirePrinterOwner,
} from "./api/registered-printer";
export type { PrinterType, RegisteredPrinter } from "./api/registered-printer";
