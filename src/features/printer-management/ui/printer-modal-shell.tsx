"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface PrinterModalShellProps {
  children: ReactNode;
  labelledBy: string;
  describedBy?: string;
  size?: "sm" | "md";
  onClose: () => void;
}

export function PrinterModalShell({
  children,
  labelledBy,
  describedBy,
  size = "md",
  onClose,
}: PrinterModalShellProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";

    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus();
      }
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className={`${size === "sm" ? "max-w-[440px]" : "max-w-[560px]"} m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-[20px] bg-[#fbfbfb] p-6 shadow-2xl backdrop:bg-black/40 sm:p-8`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) {
          return;
        }
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left || event.clientX > bounds.right ||
          event.clientY < bounds.top || event.clientY > bounds.bottom
        ) {
          onClose();
        }
      }}
    >
      {children}
    </dialog>
  );
}
