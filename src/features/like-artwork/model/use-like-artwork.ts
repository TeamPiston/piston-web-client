"use client";

import { useRef, useState } from "react";
import { toggleMockFeedLike } from "@/shared/mock/mock-data";

export function useLikeArtwork(initialLiked = false, artworkId?: string) {
  const [liked, setLiked] = useState(initialLiked);
  const [isPending, setIsPending] = useState(false);
  const isTogglingRef = useRef(false);

  const toggleLike = async () => {
    if (isTogglingRef.current) {
      return;
    }

    if (!artworkId) {
      setLiked((prev) => !prev);
      return;
    }

    const previousLiked = liked;
    isTogglingRef.current = true;
    setIsPending(true);
    // TODO: 실제 API 연동 시 낙관적 업데이트 및 실패 시 롤백 로직 적용
    setLiked(!previousLiked);

    try {
      const nextLiked = await toggleMockFeedLike(artworkId);
      setLiked(nextLiked);
    } catch {
      setLiked(previousLiked);
    } finally {
      isTogglingRef.current = false;
      setIsPending(false);
    }
  };

  return { liked, isPending, toggleLike };
}
