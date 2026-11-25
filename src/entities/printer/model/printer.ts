export type PrinterConnectionStatus = "connected" | "disconnected";

export interface Printer {
  id: string;
  name: string;
  model: string;
  ipAddress: string;
  connectionStatus: PrinterConnectionStatus;
}

export type PrintStatus = "COMPLETED" | "EMPTY" | "PRINTING";

export interface PrintJob {
  colorMode: string;
  printerId: string;
  stlUrl: string;
  title: string;
}
