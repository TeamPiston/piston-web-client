"use client";

import type { Printer } from "@/entities/printer";

interface PrinterControlsProps {
  printer: Printer;
  onCheckConnection: (printer: Printer) => void;
  onEdit: (printer: Printer) => void;
  onDelete: (printer: Printer) => void;
}

export function PrinterControls({ printer, onCheckConnection, onEdit, onDelete }: PrinterControlsProps) {
  return (
    <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0">
      <button
        type="button"
        onClick={() => onCheckConnection(printer)}
        className="h-10 flex-1 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 sm:flex-none"
      >
        연결 확인
      </button>
      <button
        type="button"
        onClick={() => onEdit(printer)}
        className="h-10 flex-1 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 sm:flex-none"
      >
        수정
      </button>
      <button
        type="button"
        onClick={() => onDelete(printer)}
        className="h-10 flex-1 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 sm:flex-none"
      >
        삭제
      </button>
    </div>
  );
}

export function AddPrinterButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-10 shrink-0 rounded-md bg-[#5a7bff] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#4a6ee5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5a7bff]"
    >
      프린터 추가
    </button>
  );
}
