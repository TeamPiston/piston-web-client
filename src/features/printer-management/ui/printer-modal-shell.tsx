"use client";

import type { ReactNode } from "react";
import { useNativeDialog } from "@/shared/ui";

interface PrinterModalShellProps {
  children: ReactNode;
  labelledBy: string;
  describedBy?: string;
  size?: "sm" | "md";
  onClose: () => void;
  getFallbackFocusTargets?: () => readonly (HTMLElement | null)[];
}

export function PrinterModalShell({
  children,
  labelledBy,
  describedBy,
  size = "md",
  onClose,
  getFallbackFocusTargets,
}: PrinterModalShellProps) {
  const { dialogRef, onCancel } = useNativeDialog({ onClose, getFallbackFocusTargets });

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className={`${size === "sm" ? "max-w-[440px]" : "max-w-[560px]"} m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-[20px] bg-[#fbfbfb] p-6 shadow-2xl backdrop:bg-black/40 sm:p-8`}
      onCancel={onCancel}
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
