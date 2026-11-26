"use client";

import { useEffect, useRef, type RefObject, type SyntheticEvent } from "react";

interface NativeDialogOptions {
  isOpen?: boolean;
  onClose: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
  returnFocusRef?: RefObject<HTMLElement | null>;
  getFallbackFocusTargets?: () => readonly (HTMLElement | null)[];
}

function isAvailable(element: Element | null): element is HTMLElement {
  if (
    !(element instanceof HTMLElement) || element === document.body ||
    !element.isConnected || element.matches(":disabled") ||
    element.closest("[hidden], [inert]") || element.getClientRects().length === 0
  ) return false;

  const { visibility } = getComputedStyle(element);
  return visibility !== "hidden" && visibility !== "collapse";
}

function focusIfAvailable(element: Element | null) {
  if (!isAvailable(element)) return false;
  element.focus({ preventScroll: true });
  return document.activeElement === element;
}

const tabbableSelector = "a[href], button, input:not([type=hidden]), select, textarea, summary, [tabindex], [contenteditable=true]";

function trapTab(event: KeyboardEvent) {
  if (event.key !== "Tab" || event.defaultPrevented) return;

  const dialog = event.currentTarget as HTMLDialogElement;
  const stops = Array.from(dialog.querySelectorAll<HTMLElement>(tabbableSelector))
    .filter((element) => element.tabIndex >= 0 && isAvailable(element));
  const first = stops[0];
  const last = stops.at(-1);
  const active = document.activeElement;

  if (!first || !last) {
    // A pending submission can temporarily disable every action.
    event.preventDefault();
    if (!dialog.contains(active)) dialog.focus({ preventScroll: true });
  } else if (!stops.some((element) => element === active) || active === (event.shiftKey ? first : last)) {
    event.preventDefault();
    focusIfAvailable(event.shiftKey ? last : first);
  }
}

// Multiple native dialogs may overlap; restore scrolling only after the last closes.
let openDialogs = 0;
let originalOverflow = "";

export function useNativeDialog({
  isOpen = true, onClose, initialFocusRef, returnFocusRef, getFallbackFocusTargets,
}: NativeDialogOptions) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!isOpen || !dialog) return;

    const returnTarget = returnFocusRef?.current ?? document.activeElement;
    dialog.showModal();
    dialog.addEventListener("keydown", trapTab);
    if (initialFocusRef?.current) focusIfAvailable(initialFocusRef.current);
    if (openDialogs++ === 0) originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      dialog.removeEventListener("keydown", trapTab);
      dialog.close();
      if (--openDialogs === 0) document.body.style.overflow = originalOverflow;
      if (!focusIfAvailable(returnTarget)) {
        for (const target of getFallbackFocusTargets?.() ?? []) {
          if (focusIfAvailable(target)) break;
        }
      }
    };
  }, [isOpen, initialFocusRef, returnFocusRef, getFallbackFocusTargets]);

  const onCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    onClose();
  };

  return { dialogRef, onCancel };
}
