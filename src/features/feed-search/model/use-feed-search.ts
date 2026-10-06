"use client";

import { useState } from "react";
import type { Artwork } from "@/entities/artwork";

export function useFeedSearch<T extends Artwork>(items: T[]) {
  const [query, setQuery] = useState("");

  const filteredItems = items.filter((artwork) => {
    const normalizedQuery = query.replace(/\s+/g, "").toLowerCase();
    const normalizedTitle = artwork.title.replace(/\s+/g, "").toLowerCase();
    const normalizedAuthor = artwork.author.replace(/\s+/g, "").toLowerCase();

    return (
      normalizedTitle.includes(normalizedQuery) ||
      normalizedAuthor.includes(normalizedQuery)
    );
  });

  return {
    query,
    setQuery,
    filteredItems,
  };
}
