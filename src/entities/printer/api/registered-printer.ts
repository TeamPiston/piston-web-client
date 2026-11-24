import { ApiError, apiClient, type ApiRequestOptions } from "@/shared/api";
import type { AuthSnapshot } from "@/shared/api/auth";
import type { Printer } from "../model/printer";

export const PRINTER_TYPES = ["moonraker", "octoprint", "bambu", "prusalink"] as const;
export type PrinterType = (typeof PRINTER_TYPES)[number];

export interface RegisteredPrinter extends Printer {
  model: PrinterType;
  userId: string;
  serialNumber: string | null;
  hasApiKey: boolean;
  hasAccessCode: boolean;
  createdAt: string;
  updatedAt: string;
}

export function isPrinterType(value: unknown): value is PrinterType {
  return PRINTER_TYPES.some((type) => type === value);
}

export function isPrinterUrl(value: string) {
  try {
    const url = new URL(value);
    return /^https?:\/\//i.test(value) && (url.protocol === "http:" || url.protocol === "https:") &&
      !url.username && !url.password;
  } catch {
    return false;
  }
}

function isId(value: unknown): value is string {
  return typeof value === "string" && /^[1-9][0-9]*$/.test(value);
}

export function decodeRegisteredPrinter(value: unknown): RegisteredPrinter {
  if (!value || typeof value !== "object" ||
    !("printerId" in value) || !isId(value.printerId) ||
    !("userId" in value) || !isId(value.userId) ||
    !("name" in value) || typeof value.name !== "string" || !value.name.trim() || value.name.length > 100 ||
    !("type" in value) || !isPrinterType(value.type) ||
    !("url" in value) || typeof value.url !== "string" || value.url.length > 500 || !isPrinterUrl(value.url) ||
    !("serialNumber" in value) || (value.serialNumber !== null && typeof value.serialNumber !== "string") ||
    !("hasApiKey" in value) || typeof value.hasApiKey !== "boolean" ||
    !("hasAccessCode" in value) || typeof value.hasAccessCode !== "boolean" ||
    !("status" in value) || (value.status !== "online" && value.status !== "offline") ||
    !("createdAt" in value) || typeof value.createdAt !== "string" || !Number.isFinite(Date.parse(value.createdAt)) ||
    !("updatedAt" in value) || typeof value.updatedAt !== "string" || !Number.isFinite(Date.parse(value.updatedAt))) {
    throw new Error("Invalid printer response");
  }
  return {
    id: value.printerId,
    userId: value.userId,
    name: value.name,
    model: value.type,
    ipAddress: value.url,
    serialNumber: value.serialNumber,
    hasApiKey: value.hasApiKey,
    hasAccessCode: value.hasAccessCode,
    connectionStatus: value.status === "online" ? "connected" : "disconnected",
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

export function printerPath(id: string) {
  if (!isId(id)) throw new Error("Invalid printer ID");
  return "/printer/" + id;
}

export function requirePrinterOwner(printer: RegisteredPrinter, userId: string, id?: string) {
  if (printer.userId !== userId || (id !== undefined && printer.id !== id)) {
    throw new Error("Unexpected printer owner or ID");
  }
  return printer;
}

export async function requestPrinter<T>(path: string, options: Omit<ApiRequestOptions<T>, "skipAuth"> & { authSnapshot: AuthSnapshot }) {
  if (!options.authSnapshot.session || !options.authSnapshot.accessToken) {
    throw new ApiError("로그인 상태를 확인해 주세요.", 401, null);
  }
  try {
    return await apiClient.request<T>(path, { ...options, redirect: "error" });
  } catch (error) {
    // Response bodies can echo rejected inputs. Do not expose them to consumers.
    if (error instanceof ApiError) throw new ApiError("프린터 요청을 완료하지 못했어요.", error.status, null, error.kind);
    throw error;
  }
}

export function listPrinters(userId: string, authSnapshot: AuthSnapshot, signal: AbortSignal) {
  return requestPrinter("/printer", {
    authSnapshot, signal, method: "GET",
    decode(data, status) {
      if (status !== 200 || !Array.isArray(data)) throw new Error("Invalid printer list");
      const printers = data.map((item: unknown) => requirePrinterOwner(decodeRegisteredPrinter(item), userId));
      if (new Set(printers.map(({ id }) => id)).size !== printers.length) throw new Error("Duplicate printer ID");
      return printers;
    },
  });
}

export function getPrinter(id: string, userId: string, authSnapshot: AuthSnapshot, signal: AbortSignal) {
  return requestPrinter(printerPath(id), {
    authSnapshot, signal, method: "GET",
    decode(data, status) {
      if (status !== 200) throw new Error("Unexpected status");
      return requirePrinterOwner(decodeRegisteredPrinter(data), userId, id);
    },
  });
}
