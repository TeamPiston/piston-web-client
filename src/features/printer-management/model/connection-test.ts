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
