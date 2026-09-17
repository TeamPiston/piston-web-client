"use client";

import { Heart } from "lucide-react";
import { useLikeArtwork } from "../model/use-like-artwork";

export function LikeButton() {
  const { liked, toggleLike } = useLikeArtwork();

  return (
    <button
      type="button"
      onClick={toggleLike}
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
  );
}
