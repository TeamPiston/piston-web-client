"use client";

import Image from "next/image";
import { useLikeArtwork } from "../model/use-like-artwork";

export function LikeButton() {
  const { liked, toggleLike } = useLikeArtwork();

  return (
    <button
      type="button"
      onClick={toggleLike}
      aria-pressed={liked}
      aria-label={liked ? "찜하기 취소" : "찜하기"}
      className="flex h-7 w-7 shrink-0 items-center justify-center transition-opacity hover:opacity-75"
    >
      <Image
        src={liked ? "/on.svg" : "/like.svg"}
        alt=""
        width={21}
        height={21}
        aria-hidden="true"
      />
    </button>
  );
}
