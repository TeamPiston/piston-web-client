"use client";

import { useState } from "react";
import { Box, Heart } from "lucide-react";
import type { Artwork } from "../model/artwork";

// 📦 제공해주신 카드 스펙(W:320px, H:280px, R:26px, opacity:1, angle:0) 수정한 컴포넌트
export function ArtworkCard({ artwork }: { artwork: Artwork }) {
  const [liked, setLiked] = useState(false);

  return (
    <div className="w-[320px] h-[280px] rounded-[26px] bg-white/80 p-4 shadow-sm ring-1 ring-black/[0.03] backdrop-blur-sm transition hover:shadow-md flex flex-col justify-between opacity-100 rotate-0">
      <div className="flex-1 flex items-center justify-center rounded-[18px] bg-gray-50/50 border border-gray-100/50">
        <Box className="h-20 w-20 text-gray-800" strokeWidth={0.75} />
      </div>

      <div className="mt-3 flex items-end justify-between px-1 pb-0.5">
        <div>
          <p className="text-xs font-bold text-gray-900 leading-tight">{artwork.title}</p>
          <p className="mt-1 text-[10px] text-gray-400">{artwork.author}</p>
        </div>

        <button
          type="button"
          onClick={() => setLiked((prev) => !prev)}
          aria-pressed={liked}
          aria-label="찜하기"
          className="flex h-6 w-6 shrink-0 items-center justify-center text-gray-300 transition hover:text-gray-500"
        >
          <Heart
            className="h-4 w-4"
            strokeWidth={2}
            fill={liked ? "#5A7BFF" : "none"}
            color={liked ? "#5A7BFF" : "currentColor"}
          />
        </button>
      </div>
    </div>
  );
}
