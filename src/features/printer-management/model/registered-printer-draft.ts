import { isPrinterType, isPrinterUrl, type PrinterType, type RegisteredPrinter } from "@/entities/printer";

export interface RegisteredPrinterDraft {
  name: string;
  type: string;
  url: string;
  serialNumber: string;
  apiKey: string;
  accessCode: string;
  removeApiKey: boolean;
  removeAccessCode: boolean;
}

interface PrinterFields {
  name: string;
  type: PrinterType;
  url: string;
}

export interface CreatePrinterPayload extends PrinterFields {
  serialNumber?: string;
  apiKey?: string;
  accessCode?: string;
}

export interface UpdatePrinterPayload extends Partial<PrinterFields> {
  serialNumber?: string | null;
  apiKey?: string | null;
  accessCode?: string | null;
}

export function acceptsApiKey(type: string) {
  return type === "octoprint" || type === "prusalink";
}

export function createPrinterDraft(printer: RegisteredPrinter | null): RegisteredPrinterDraft {
  return {
    name: printer?.name ?? "",
    type: printer?.model ?? "",
    url: printer?.ipAddress ?? "",
    serialNumber: printer?.serialNumber ?? "",
    apiKey: "",
    accessCode: "",
    removeApiKey: false,
    removeAccessCode: false,
  };
}

export function validatePrinterDraft(draft: RegisteredPrinterDraft): draft is RegisteredPrinterDraft & { type: PrinterType } {
  return !!draft.name.trim() && draft.name.trim().length <= 100 && isPrinterType(draft.type) &&
    draft.url.trim().length <= 500 && isPrinterUrl(draft.url.trim());
}

export function createPrinterPayload(draft: RegisteredPrinterDraft & { type: PrinterType }): CreatePrinterPayload {
  const payload: CreatePrinterPayload = { name: draft.name.trim(), type: draft.type, url: draft.url.trim() };
  if (acceptsApiKey(draft.type) && draft.apiKey.trim()) payload.apiKey = draft.apiKey;
  if (draft.type === "bambu") {
    if (draft.serialNumber.trim()) payload.serialNumber = draft.serialNumber.trim();
    if (draft.accessCode.trim()) payload.accessCode = draft.accessCode;
  }
  return payload;
}

export function updatePrinterPayload(
  draft: RegisteredPrinterDraft & { type: PrinterType },
  printer: RegisteredPrinter,
): UpdatePrinterPayload {
  const incoming = createPrinterPayload(draft);
  const payload: UpdatePrinterPayload = {};
  if (incoming.name !== printer.name) payload.name = incoming.name;
  if (incoming.type !== printer.model) payload.type = incoming.type;
  if (incoming.url !== printer.ipAddress) payload.url = incoming.url;
  if (draft.type === "bambu" && (incoming.serialNumber ?? null) !== printer.serialNumber) {
    payload.serialNumber = incoming.serialNumber ?? null;
  }
  if (draft.removeApiKey) payload.apiKey = null;
  else if (incoming.apiKey !== undefined) payload.apiKey = incoming.apiKey;
  if (draft.removeAccessCode) payload.accessCode = null;
  else if (incoming.accessCode !== undefined) payload.accessCode = incoming.accessCode;
  return payload;
}
