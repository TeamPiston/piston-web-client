"use client";

import { useState } from "react";
import { usePrinterQuery, type Printer, type PrinterConnectionStatus } from "@/entities/printer";
import { usePrinterActions } from "./context";
import { getMockPrinterConnectionTestResult, type PrinterConnectionTestResult } from "./connection-test";
import type { PrinterDraft } from "./printer-draft";

export function usePrinterManagement() {
  const { printers } = usePrinterQuery();
  const { setPrinters } = usePrinterActions();
  const [editingPrinter, setEditingPrinter] = useState<Printer | null>(null);
  const [deletingPrinter, setDeletingPrinter] = useState<Printer | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const openAddForm = () => {
    setEditingPrinter(null);
    setIsFormOpen(true);
  };

  const openEditForm = (printer: Printer) => {
    setEditingPrinter(printer);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingPrinter(null);
  };

  const savePrinter = (
    nextPrinter: PrinterDraft,
    testedStatus: PrinterConnectionStatus | null,
  ) => {
    if (!editingPrinter && testedStatus !== "connected") {
      return;
    }

    if (editingPrinter) {
      setPrinters((currentPrinters) =>
        currentPrinters.map((printer) =>
          printer.id === editingPrinter.id
            ? {
                ...printer,
                ...nextPrinter,
                connectionStatus:
                  testedStatus ??
                  (printer.ipAddress === nextPrinter.ipAddress &&
                  printer.model === nextPrinter.model
                    ? printer.connectionStatus
                    : "disconnected"),
              }
            : printer,
        ),
      );
      setAnnouncement(`${nextPrinter.name} 프린터 정보를 수정했습니다.`);
    } else {
      setPrinters((currentPrinters) => [
        ...currentPrinters,
        {
          id: crypto.randomUUID(),
          ...nextPrinter,
          connectionStatus: testedStatus ?? "disconnected",
        },
      ]);
      setAnnouncement(`${nextPrinter.name} 프린터를 추가했습니다.`);
    }

    closeForm();
  };

  const testPrinterConnection = (draft: PrinterDraft): PrinterConnectionTestResult => {
    if (!editingPrinter) {
      return getMockPrinterConnectionTestResult(draft.model, draft.ipAddress);
    }
    const printer = printers.find(
      (currentPrinter) =>
        currentPrinter.ipAddress === draft.ipAddress.trim() &&
        currentPrinter.model === draft.model,
    );
    if (!printer) {
      return {
        status: "disconnected",
        message: "이 IP 주소의 연결 정보가 없습니다. 실제 연결 테스트는 서버 연동 후 사용할 수 있어요.",
      };
    }
    return printer.connectionStatus === "connected"
      ? getMockPrinterConnectionTestResult(draft.model, draft.ipAddress)
      : {
          status: "disconnected",
          message: "예시 연결 결과: 연결 끊김. 같은 와이파이와 IP 주소를 확인해 주세요.",
        };
  };

  const checkPrinterConnection = (printer: Printer) => {
    const result = getMockPrinterConnectionTestResult(printer.model, printer.ipAddress);
    setPrinters((currentPrinters) =>
      currentPrinters.map((currentPrinter) =>
        currentPrinter.id === printer.id
          ? { ...currentPrinter, connectionStatus: result.status }
          : currentPrinter,
      ),
    );
    setAnnouncement(result.status === "connected"
      ? `${printer.name} 프린터는 연결됨 상태입니다.`
      : `${printer.name}: ${result.message}`);
  };

  const deletePrinter = (printerId: string) => {
    if (!deletingPrinter || deletingPrinter.id !== printerId) {
      return;
    }

    setPrinters((currentPrinters) =>
      currentPrinters.filter((currentPrinter) => currentPrinter.id !== printerId),
    );
    setAnnouncement(`${deletingPrinter.name} 프린터를 삭제했습니다.`);
    setDeletingPrinter(null);
  };
  return {
    editingPrinter,
    deletingPrinter,
    isFormOpen,
    announcement,
    openAddForm,
    openEditForm,
    closeForm,
    savePrinter,
    testPrinterConnection,
    checkPrinterConnection,
    deletePrinter,
    openDeleteForm: setDeletingPrinter,
    closeDeleteForm: () => setDeletingPrinter(null),
  };
}
