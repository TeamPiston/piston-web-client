"use client";

import { useEffect, useState } from "react";
import { ArtworkCard, ArtworkCardSkeleton, MOCK_ARTWORKS } from "@/entities/artwork";
import { EmptyResult, FeedSearchInput, useFeedSearch } from "@/features/feed-search";
import { LikeButton } from "@/features/like-artwork";
import { Header } from "@/widgets/header";

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
    <div className="mx-auto min-h-screen w-full max-w-[1920px] overflow-x-clip bg-[#fbfbfb] xl:h-dvh xl:min-h-0 xl:overflow-hidden">
      <div className="flex min-h-screen w-full flex-col xl:h-full xl:min-h-0">
        <Header />

        <main
          aria-busy={isLoading}
          className="mx-auto flex min-h-[calc(100dvh-var(--header-height))] w-full max-w-6xl flex-1 flex-col items-center px-4 py-6 sm:px-8 xl:h-[calc(100dvh-var(--header-height))] xl:min-h-0 xl:flex-none xl:overflow-y-auto"
        >
          <FeedSearchInput value={query} onChange={setQuery} />

          {!hasEmptyResults && (
            <div className="grid w-full shrink-0 items-start">
              <div
                aria-hidden={!isLoading}
                className={[
                  "col-start-1 row-start-1 grid w-full grid-cols-1 justify-items-center gap-6 transition-opacity duration-300 sm:grid-cols-2 lg:grid-cols-3",
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
                  "col-start-1 row-start-1 grid w-full grid-cols-1 justify-items-center gap-6 transition-opacity duration-300 sm:grid-cols-2 lg:grid-cols-3",
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
