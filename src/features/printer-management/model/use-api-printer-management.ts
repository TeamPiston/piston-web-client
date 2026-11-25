"use client";

import { useEffect, useRef, useState } from "react";
import { getPrinter, listPrinters, type RegisteredPrinter } from "@/entities/printer";
import { ApiError } from "@/shared/api";
import { captureAuth, type AuthSnapshot } from "@/shared/api/auth";
import { registerPrinter, unregisterPrinter, updatePrinter } from "../api/printer-mutations";
import {
  createPrinterPayload, updatePrinterPayload, validatePrinterDraft, type RegisteredPrinterDraft,
} from "./registered-printer-draft";

const AUTH_STATUS_ERROR = "로그인 상태를 확인할 수 없어요. 잠시 후 다시 시도해 주세요.";

function getPrinterError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return "로그인이 만료되었거나 계정이 바뀌었어요. 다시 로그인해 주세요.";
    if (error.status === 403) return "이 프린터에 접근할 권한이 없어요.";
    if (error.status === 404) return "프린터를 찾을 수 없어요. 목록을 새로고침해 주세요.";
    if (error.kind === "network") return "서버에 연결할 수 없어요. 네트워크를 확인해 주세요.";
  }
  return "프린터 요청을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.";
}

function capturePrinterAuth(sessionId: string) {
  const snapshot = captureAuth();
  if (snapshot.session?.id !== sessionId) throw new ApiError("로그인 계정이 변경되었습니다.", 401, null);
  return snapshot;
}

export function useApiPrinterManagement(userId: string, sessionId: string) {
  const [printers, setPrinters] = useState<RegisteredPrinter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [listVersion, setListVersion] = useState(0);
  const [form, setForm] = useState<{ printer: RegisteredPrinter | null } | null>(null);
  const [deletingPrinter, setDeletingPrinter] = useState<RegisteredPrinter | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const pending = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    void (async () => {
      const snapshot = captureAuth();
      if (snapshot.storage.status === "unavailable") {
        setLoadError(AUTH_STATUS_ERROR);
        setIsLoading(false);
        return;
      }
      if (snapshot.session?.id !== sessionId) return;

      let result: { printers: RegisteredPrinter[] } | { error: string };
      try {
        result = { printers: await listPrinters(userId, snapshot, signal) };
      } catch (error: unknown) {
        result = { error: getPrinterError(error) };
      }

      if (signal.aborted) return;
      const current = captureAuth();
      if (current.storage.status === "unavailable") {
        setLoadError(AUTH_STATUS_ERROR);
      } else if (current.session?.id !== sessionId) {
        return;
      } else if ("error" in result) {
        setLoadError(result.error);
      } else {
        setPrinters(result.printers);
      }
      setIsLoading(false);
    })();
    return () => {
      controller.abort();
      pending.current?.abort();
      pending.current = null;
    };
  }, [userId, sessionId, listVersion]);

  const reload = () => {
    if (pending.current || isLoading) return;
    setLoadError("");
    setActionError("");
    setIsLoading(true);
    setListVersion((version) => version + 1);
  };

  const run = async <T,>(
    operation: (auth: AuthSnapshot, signal: AbortSignal) => Promise<T>,
    onSuccess: (result: T) => void,
  ) => {
    if (pending.current || isLoading) return;
    const controller = new AbortController();
    pending.current = controller;
    const { signal } = controller;
    setBusy(true);
    setActionError("");
    setAnnouncement("");
    try {
      const result = await operation(capturePrinterAuth(sessionId), signal);
      if (!signal.aborted && captureAuth().session?.id === sessionId) onSuccess(result);
    } catch (error: unknown) {
      if (!signal.aborted && captureAuth().session?.id === sessionId) setActionError(getPrinterError(error));
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setBusy(false);
      }
    }
  };

  const openAddForm = () => {
    if (pending.current || isLoading) return;
    setActionError("");
    setForm({ printer: null });
  };
  const openEditForm = (printer: RegisteredPrinter) =>
    run((auth, signal) => getPrinter(printer.id, userId, auth, signal), (result) => setForm({ printer: result }));
  const closeForm = () => {
    if (pending.current) return;
    setForm(null);
    setActionError("");
  };
  const openDeleteForm = (printer: RegisteredPrinter) => {
    if (pending.current || isLoading) return;
    setActionError("");
    setDeletingPrinter(printer);
  };
  const closeDeleteForm = () => {
    if (pending.current) return;
    setDeletingPrinter(null);
    setActionError("");
  };

  const savePrinter = (draft: RegisteredPrinterDraft) => {
    if (!form || pending.current) return;
    if (!validatePrinterDraft(draft)) {
      setActionError("이름, 프린터 종류, HTTP 또는 HTTPS 주소를 확인해 주세요.");
      return;
    }
    const { printer } = form;
    const changes = printer ? updatePrinterPayload(draft, printer) : null;
    if (printer && changes && Object.keys(changes).length === 0) {
      closeForm();
      return;
    }
    void run((auth, signal) => printer && changes
      ? updatePrinter(printer.id, changes, userId, auth, signal)
      : registerPrinter(createPrinterPayload(draft), userId, auth, signal), (saved) => {
      setPrinters((current) => current.some(({ id }) => id === saved.id)
        ? current.map((item) => item.id === saved.id ? saved : item)
        : [...current, saved]);
      setForm(null);
      setAnnouncement(saved.name + (printer ? " 프린터 정보를 수정했습니다." : " 프린터를 추가했습니다."));
    });
  };

  const deletePrinter = (id: string) => {
    if (deletingPrinter?.id !== id) return;
    void run((auth, signal) => unregisterPrinter(id, auth, signal), () => {
      setPrinters((current) => current.filter((printer) => printer.id !== id));
      setDeletingPrinter(null);
      setAnnouncement(deletingPrinter.name + " 프린터를 삭제했습니다.");
    });
  };

  return {
    printers, isLoading, loadError, reload, form, deletingPrinter, busy, actionError, announcement,
    openAddForm, openEditForm, closeForm, openDeleteForm, closeDeleteForm, savePrinter, deletePrinter,
  };
}
