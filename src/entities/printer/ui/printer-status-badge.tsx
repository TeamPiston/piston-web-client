import type { PrinterConnectionStatus } from "../model/printer";

export function PrinterStatusBadge({ status }: { status: PrinterConnectionStatus }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
        status === "connected"
          ? "bg-emerald-50 text-emerald-500"
          : "bg-gray-100 text-gray-500",
      ].join(" ")}
    >
      <span aria-hidden="true">●</span>
      {status === "connected"
        ? "연결됨"
        : "연결 끊김"}
    </span>
  );
}
