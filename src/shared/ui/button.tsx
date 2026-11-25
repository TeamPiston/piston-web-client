import type { ButtonHTMLAttributes } from "react";

const BASE_CLASSES =
  "w-full h-12 bg-[#5B7FFF] text-white font-semibold rounded-xl text-sm hover:bg-[#4a6ee5] active:scale-[0.99] disabled:bg-[#8da6ff] disabled:scale-100 disabled:cursor-not-allowed transition-all mt-2 shadow-sm shadow-blue-200";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ className = "", ...props }: ButtonProps) {
  return <button className={`${BASE_CLASSES} ${className}`} {...props} />;
}
