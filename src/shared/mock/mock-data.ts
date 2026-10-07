export type PrinterConnectionStatus = "connected" | "disconnected";

export interface Printer {
  id: string;
  name: string;
  model: string;
  ipAddress: string;
  connectionStatus: PrinterConnectionStatus;
}

export type PrinterConnectionTestResult =
  | {
      status: "connected";
      model: string;
      nozzleTemperature: number;
      bedTemperature: number;
      activity: string;
    }
  | { status: "disconnected"; message: string };

export function getMockPrinterConnectionTestResult(
  model: string,
  ipAddress: string,
): PrinterConnectionTestResult {
  if (ipAddress.trim().endsWith(".99")) {
    return {
      status: "disconnected",
      message: "프린터를 찾을 수 없어요",
    };
  }

  return {
    status: "connected",
    model,
    nozzleTemperature: 32,
    bedTemperature: 29,
    activity: "대기 중",
  };
}

export const MOCK_PRINTERS: Printer[] = [
  {
    id: "printer-max4-02",
    name: "MAX4_02",
    model: "QIDI X-Max 4",
    ipAddress: "192.168.0.24",
    connectionStatus: "connected",
  },
  {
    id: "printer-classroom",
    name: "교실 프린터",
    model: "QIDI X-Max 4",
    ipAddress: "192.168.0.31",
    connectionStatus: "disconnected",
  },
];

export function getPrintersWithFallback(
  printers?: Printer[] | null,
): Printer[] {
  return printers ?? MOCK_PRINTERS;
}
