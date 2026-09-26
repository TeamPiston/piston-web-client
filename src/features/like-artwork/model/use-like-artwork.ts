"use client";

import { useState } from "react";

export function useLikeArtwork(initialLiked = false) {
  const [liked, setLiked] = useState(initialLiked);

  const toggleLike = () => setLiked((prev) => !prev);

  return { liked, toggleLike };
}
