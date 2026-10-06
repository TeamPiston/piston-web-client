"use client";

import { useState } from "react";
import { toggleMockFeedLike } from "@/shared/mock/mock-data";

export function useLikeArtwork(initialLiked = false, artworkId?: string) {
  const [liked, setLiked] = useState(initialLiked);

  const toggleLike = () => {
    setLiked((prev) => !prev);
    if (artworkId) {
      void toggleMockFeedLike(artworkId);
    }
  };

  return { liked, toggleLike };
}
