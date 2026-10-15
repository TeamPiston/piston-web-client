export type PrinterConnectionTestResult =
  | {
      status: "connected";
      model: string;
      nozzleTemperature: number;
      bedTemperature: number;
      activity: string;
    }
  | { status: "disconnected"; message: string };

// Reserved failure scenario for mock feedback; this performs no network request.
const MOCK_UNREACHABLE_IP_SUFFIX = ".99";

// TODO: Replace this deterministic mock with the backend connection-test response.
export function getMockPrinterConnectionTestResult(
  model: string,
  ipAddress: string,
): PrinterConnectionTestResult {
  if (ipAddress.trim().endsWith(MOCK_UNREACHABLE_IP_SUFFIX)) {
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
