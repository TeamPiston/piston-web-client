"use client";

import { Sparkles } from "lucide-react";
import type { DesignVersion } from "../../model/types";

interface VersionHistoryProps {
  isGenerated: boolean;
  onSelectVersion: (versionId: string) => void;
  selectedVersionId: string;
  versions: DesignVersion[];
}

export function VersionHistory({
  isGenerated,
  onSelectVersion,
  selectedVersionId,
  versions,
}: VersionHistoryProps) {
  return (
    <aside className="flex min-h-[420px] min-w-0 flex-col border-l border-gray-200 bg-white px-5 py-7 xl:min-h-0">
      <h2 className="text-sm font-bold text-gray-950">버전</h2>
      {!isGenerated ? (
        <p className="mt-4 text-xs leading-5 text-gray-400">
          아직 기록이 없어요. 디자인을 만들면 여기에 쌓여요.
        </p>
      ) : (
        <div className="mt-4 flex min-h-0 flex-col gap-3 xl:flex-1 xl:overflow-y-auto">
          {[...versions].reverse().map((version) => {
            const isSelected = selectedVersionId === version.id;

            return (
              <button
                key={version.id}
                type="button"
                onClick={() => onSelectVersion(version.id)}
                className={[
                  "flex w-full shrink-0 items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                  isSelected
                    ? "border-transparent bg-[#eef2ff]"
                    : "border-gray-200 bg-white hover:bg-gray-50",
                ].join(" ")}
              >
                <span className="mt-0.5 h-10 w-10 shrink-0 rounded-lg bg-gray-50" />
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-gray-950">{version.label}</span>
                  <span className="mt-1 block text-xs leading-4 text-gray-500">
                    {version.description}
                  </span>
                  <span className="mt-1 block text-[11px] text-gray-400">{version.meta}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
      {isGenerated && (
        <p className="mt-6 flex shrink-0 items-center gap-2 text-xs text-gray-400">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          수정할 때마다 자동으로 저장돼요.
        </p>
      )}
    </aside>
  );
}
