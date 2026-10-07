"use client";

import { useId } from "react";
import type { Printer } from "@/shared/mock/mock-data";
import { PrinterModalShell } from "./printer-modal-shell";

interface PrinterDeleteModalProps {
  printer: Pick<Printer, "id" | "name">;
  onClose: () => void;
  onConfirm: (printerId: string) => void;
}

export function PrinterDeleteModal({
  printer,
  onClose,
  onConfirm,
}: PrinterDeleteModalProps) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <PrinterModalShell
      labelledBy={titleId}
      describedBy={descriptionId}
      onClose={onClose}
    >
      <h2 id={titleId} className="break-words text-center text-lg font-bold text-gray-950">
        {printer.name}를 삭제할까요?
      </h2>
      <p id={descriptionId} className="mt-3 text-center text-sm leading-5 text-gray-500">
        등록 정보만 지워지고 프린터 자체에는 영향이 없어요.
        <br className="hidden sm:block" />
        {" "}다시 쓰려면 IP 주소를 새로 입력해 등록해야 해요.
      </p>
      <ul className="mt-6 list-disc space-y-2 rounded-xl bg-[#f5f5f5] py-4 pr-4 pl-8 text-xs leading-5 text-gray-950 marker:text-gray-500">
        <li>이 프린터로 진행 중인 출력이 있으면 먼저 취소돼요</li>
        <li>프린터를 다시 추가해야 해요</li>
      </ul>
      <div className="mt-7 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onClose}
          className="h-[58px] rounded-lg border border-gray-300 bg-gray-50 text-base font-medium text-gray-500 transition-colors hover:bg-gray-100"
        >
          취소
        </button>
        <button
          type="button"
          onClick={() => onConfirm(printer.id)}
          className="h-[58px] rounded-lg bg-red-500 text-base font-medium text-white transition-colors hover:bg-red-600"
        >
          삭제하기
        </button>
      </div>
    </PrinterModalShell>
  );
}
