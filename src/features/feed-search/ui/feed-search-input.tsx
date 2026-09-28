"use client";

import { Search } from "lucide-react";

interface FeedSearchInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function FeedSearchInput({ value, onChange }: FeedSearchInputProps) {
  return (
    <div className="mb-10 h-12 w-full max-w-[400px] sm:mb-12">
      <div className="flex h-full w-full items-center justify-between rounded-[20px] bg-white px-4 py-2 opacity-100 shadow-sm ring-1 ring-black/[0.04] sm:px-6">
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
