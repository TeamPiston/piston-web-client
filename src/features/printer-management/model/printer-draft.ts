import type { Printer } from "@/entities/printer";

export type PrinterDraft = Pick<Printer, "name" | "model" | "ipAddress">;
