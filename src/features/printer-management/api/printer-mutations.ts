import { decodeRegisteredPrinter, printerPath, requestPrinter, requirePrinterOwner } from "@/entities/printer";
import type { AuthSnapshot } from "@/shared/api/auth";
import type { CreatePrinterPayload, UpdatePrinterPayload } from "../model/registered-printer-draft";

export function registerPrinter(payload: CreatePrinterPayload, userId: string, authSnapshot: AuthSnapshot, signal: AbortSignal) {
  return requestPrinter("/printer", {
    authSnapshot, signal, method: "POST", body: payload,
    decode(data, status) {
      if (status !== 201) throw new Error("Unexpected status");
      return requirePrinterOwner(decodeRegisteredPrinter(data), userId);
    },
  });
}

export function updatePrinter(
  id: string, payload: UpdatePrinterPayload, userId: string, authSnapshot: AuthSnapshot, signal: AbortSignal,
) {
  return requestPrinter(printerPath(id), {
    authSnapshot, signal, method: "PATCH", body: payload,
    decode(data, status) {
      if (status !== 200) throw new Error("Unexpected status");
      return requirePrinterOwner(decodeRegisteredPrinter(data), userId, id);
    },
  });
}

export function unregisterPrinter(id: string, authSnapshot: AuthSnapshot, signal: AbortSignal) {
  return requestPrinter(printerPath(id), {
    authSnapshot, signal, method: "DELETE", responseBody: "text",
    decode(data, status) {
      if (status !== 200 || data !== "") throw new Error("Expected an empty printer delete response");
    },
  });
}
