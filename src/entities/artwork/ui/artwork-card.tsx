"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Box } from "lucide-react";
import type { Artwork } from "../model/artwork";

interface ArtworkCardProps {
  artwork: Artwork;
  likeSlot?: ReactNode;
}

export function ArtworkCard({ artwork, likeSlot }: ArtworkCardProps) {
  const detailHref = "/artwork/" + artwork.id;

  return (
    <div className="flex h-[280px] w-[320px] flex-col justify-between rounded-[26px] bg-white/80 p-4 shadow-sm ring-1 ring-black/[0.03] backdrop-blur-sm transition hover:shadow-md">
      <Link
        href={detailHref}
        aria-label={artwork.title + " 작품 상세 보기"}
        className="group flex min-h-0 flex-1 items-center justify-center rounded-[18px] border border-gray-100/50 bg-gray-50/50"
      >
        <Box
          className="h-20 w-20 text-gray-800 transition-transform duration-200 group-hover:scale-105"
          strokeWidth={0.75}
        />
      </Link>

      <div className="mt-3 flex items-end justify-between px-1 pb-0.5">
        <Link href={detailHref} className="min-w-0">
          <p className="truncate text-xs font-bold leading-tight text-gray-900">
            {artwork.title}
          </p>
          <p className="mt-1 text-[10px] text-gray-400">{artwork.author}</p>
        </Link>

        {likeSlot}
      </div>
    </div>
  );
}
