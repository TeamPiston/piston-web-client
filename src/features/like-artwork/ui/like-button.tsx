"use client";

import Image from "next/image";
import { useLikeArtwork } from "../model/use-like-artwork";

interface LikeButtonProps {
  artworkId?: string;
  className?: string;
  initialLiked?: boolean;
}

export function LikeButton({ artworkId, className = "", initialLiked = false }: LikeButtonProps) {
  const { liked, toggleLike } = useLikeArtwork(initialLiked, artworkId);

  return (
    <button
      type="button"
      onClick={toggleLike}
      aria-pressed={liked}
      aria-label={liked ? "찜하기 취소" : "찜하기"}
      className={"flex h-7 w-7 shrink-0 items-center justify-center transition-opacity hover:opacity-75 " + className}
    >
      <Image
        src={liked ? "/on.svg" : "/like.svg"}
        alt=""
        width={30}
        height={30}
        aria-hidden="true"
      />
    </button>
  );
}
