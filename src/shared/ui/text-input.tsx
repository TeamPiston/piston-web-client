import type { InputHTMLAttributes } from "react";

const BASE_CLASSES =
  "w-full h-12 px-4 rounded-xl border border-gray-200 bg-white/80 placeholder-gray-400 text-sm focus:outline-none focus:border-[#5B7FFF] focus:ring-1 focus:ring-[#5B7FFF] transition-all";

type TextInputProps = InputHTMLAttributes<HTMLInputElement>;

export function TextInput({ className = "", ...props }: TextInputProps) {
  return <input className={`${BASE_CLASSES} ${className}`} {...props} />;
}
