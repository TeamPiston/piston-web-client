"use client";

import { useEffect, useState } from "react";
import { ArtworkCard, ArtworkCardSkeleton, MOCK_ARTWORKS } from "@/entities/artwork";
import { EmptyResult, FeedSearchInput, useFeedSearch } from "@/features/feed-search";
import { LikeButton } from "@/features/like-artwork";
import { FeedHeader } from "@/widgets/feed-header";

export default function FeedPage() {
  const [isLoading, setIsLoading] = useState(true);
  const { query, setQuery, filteredItems } = useFeedSearch(MOCK_ARTWORKS);

  useEffect(() => {
    const loadingTimer = window.setTimeout(() => setIsLoading(false), 500);

    return () => window.clearTimeout(loadingTimer);
  }, []);

  const searchQuery = query.trim();
  const hasEmptyResults = !isLoading && searchQuery.length > 0 && filteredItems.length === 0;
  const contentStateClass = isLoading
    ? "pointer-events-none opacity-0"
    : "opacity-100";

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#fbfbfb]">
      <div className="flex min-h-screen w-full flex-col">
        <FeedHeader />

        <main
          aria-busy={isLoading}
          className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-8 py-8"
        >
          <FeedSearchInput value={query} onChange={setQuery} />

          {!hasEmptyResults && (
            <div className="grid w-full items-start">
              <div
                aria-hidden={!isLoading}
                className={[
                  "col-start-1 row-start-1 grid w-full grid-cols-1 justify-items-center gap-8 transition-opacity duration-300 sm:grid-cols-2 lg:grid-cols-3",
                  isLoading ? "opacity-100" : "pointer-events-none opacity-0",
                ].join(" ")}
              >
                {Array.from({ length: 6 }, (_, index) => (
                  <ArtworkCardSkeleton key={index} />
                ))}
              </div>

              <div
                aria-hidden={isLoading}
                className={[
                  "col-start-1 row-start-1 grid w-full grid-cols-1 justify-items-center gap-8 transition-opacity duration-300 sm:grid-cols-2 lg:grid-cols-3",
                  contentStateClass,
                ].join(" ")}
              >
                {filteredItems.map((artwork) => (
                  <ArtworkCard key={artwork.id} artwork={artwork} likeSlot={<LikeButton />} />
                ))}
              </div>
            </div>
          )}

          {hasEmptyResults && <EmptyResult query={searchQuery} />}
        </main>
      </div>
    </div>
  );
}
