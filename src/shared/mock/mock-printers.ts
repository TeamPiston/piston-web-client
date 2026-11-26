export interface MockPrinter {
  id: string;
  name: string;
  model: string;
  ipAddress: string;
  connectionStatus: "connected" | "disconnected";
}

export const MOCK_PRINTERS: MockPrinter[] = [
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

const storageKey = "piston:mock-printers:v1";
let currentPrinters: MockPrinter[] | undefined;

function isMockPrinter(value: unknown): value is MockPrinter {
  return typeof value === "object" && value !== null &&
    "id" in value && typeof value.id === "string" && value.id.length > 0 &&
    "name" in value && typeof value.name === "string" &&
    "model" in value && typeof value.model === "string" &&
    "ipAddress" in value && typeof value.ipAddress === "string" &&
    "connectionStatus" in value &&
    (value.connectionStatus === "connected" || value.connectionStatus === "disconnected");
}

// undefined means the list has never been saved. null means it could not be verified.
export function readMockPrinters(): MockPrinter[] | null | undefined {
  if (currentPrinters || typeof window === "undefined") return currentPrinters;

  try {
    const raw = window.sessionStorage?.getItem(storageKey);
    if (raw == null) return undefined;
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value) || !value.every(isMockPrinter) ||
      new Set(value.map(({ id }) => id)).size !== value.length) return null;
    currentPrinters = value;
    return currentPrinters;
  } catch {
    return null;
  }
}

export function saveMockPrinters(printers: MockPrinter[]) {
  currentPrinters = printers;
  try {
    window.sessionStorage?.setItem(storageKey, JSON.stringify(printers));
  } catch {
    // Keep printer management usable for this document.
  }
}
