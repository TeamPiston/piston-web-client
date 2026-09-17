"use client";

import { Search } from "lucide-react";

interface FeedSearchInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function FeedSearchInput({ value, onChange }: FeedSearchInputProps) {
  return (
    <div className="mb-12 w-[400px] h-[48px]">
      <div className="flex w-full h-full items-center justify-between rounded-[20px] bg-white pl-6 pr-6 py-2 shadow-sm ring-1 ring-black/[0.04] opacity-100 rotate-0">
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="검색어를 입력하세요."
          className="w-full bg-transparent text-xs text-gray-700 placeholder:text-gray-300 focus:outline-none"
        />
        <button type="button" aria-label="검색" className="text-gray-400">
          <Search className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
