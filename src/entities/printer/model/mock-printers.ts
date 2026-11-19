import type { Printer } from "./printer";

export const MOCK_PRINTERS: Printer[] = [
  {
    id: "printer-max4-02",
    name: "MAX4_02",
    model: "QIDI X-Max 4",
    ipAddress: "192.0.2.24",
    connectionStatus: "connected",
  },
  {
    id: "printer-classroom",
    name: "교실 프린터",
    model: "QIDI X-Max 4",
    ipAddress: "192.0.2.31",
    connectionStatus: "disconnected",
  },
];

export function getPrintersWithFallback(
  printers?: Printer[] | null,
): Printer[] {
  return printers ?? MOCK_PRINTERS;
}
