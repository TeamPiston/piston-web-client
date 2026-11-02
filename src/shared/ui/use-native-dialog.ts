"use client";

import { useEffect, useRef, type RefObject, type SyntheticEvent } from "react";

interface NativeDialogOptions {
  isOpen?: boolean;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
  getFallbackFocusTargets?: () => readonly (HTMLElement | null)[];
}

function focusIfAvailable(element: Element | null) {
  if (
    !(element instanceof HTMLElement) || element === document.body ||
    !element.isConnected || element.matches(":disabled") ||
    element.closest("[hidden], [inert]") || element.getClientRects().length === 0
  ) return false;

  const { visibility } = getComputedStyle(element);
  if (visibility === "hidden" || visibility === "collapse") return false;
  element.focus({ preventScroll: true });
  return document.activeElement === element;
}

// Multiple native dialogs may overlap; restore scrolling only after the last closes.
let openDialogs = 0;
let originalOverflow = "";

export function useNativeDialog({
  isOpen = true, onClose, returnFocusRef, getFallbackFocusTargets,
}: NativeDialogOptions) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!isOpen || !dialog) return;

    const returnTarget = returnFocusRef?.current ?? document.activeElement;
    dialog.showModal();
    if (openDialogs++ === 0) originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      dialog.close();
      if (--openDialogs === 0) document.body.style.overflow = originalOverflow;
      if (!focusIfAvailable(returnTarget)) {
        for (const target of getFallbackFocusTargets?.() ?? []) {
          if (focusIfAvailable(target)) break;
        }
      }
    };
  }, [isOpen, returnFocusRef, getFallbackFocusTargets]);

  const onCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    onClose();
  };

  return { dialogRef, onCancel };
}
