import type { ReactNode } from "react";

interface DemoNoticeProps {
  children: ReactNode;
  className?: string;
  isVisible: boolean;
}

export function DemoNotice({ children, className = "", isVisible }: DemoNoticeProps) {
  if (!isVisible) return null;

  return (
    <div lang="ko" className={`rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-5 break-keep text-blue-900 ${className}`}>
      {children}
    </div>
  );
}
