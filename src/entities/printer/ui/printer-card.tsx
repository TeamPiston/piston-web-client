import type { ReactNode } from "react";
import type { Printer } from "../model/printer";
import { PrinterStatusBadge } from "./printer-status-badge";

export function PrinterCard({ printer, actions }: { printer: Printer; actions?: ReactNode }) {
  return (
    <article
      className={[
        "flex flex-col gap-5 rounded-2xl border bg-white p-5 sm:flex-row sm:items-center sm:p-6",
        printer.connectionStatus === "connected"
          ? "border-[#5a7bff]"
          : "border-gray-300",
      ].join(" ")}
    >
      <div className="flex min-w-0 flex-1 items-center gap-5">
        <div
          className="h-[72px] w-[72px] shrink-0 rounded-xl bg-[#f5f5f5]"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold text-gray-950">
              {printer.name}
            </h2>
            <PrinterStatusBadge status={printer.connectionStatus} />
          </div>
          <p className="mt-2 break-words text-sm text-gray-500">
            {printer.model} · {printer.ipAddress}
          </p>
        </div>
      </div>

      {actions}
    </article>
  );
}
