"use client";

import { ArtworkCard, MOCK_ARTWORKS } from "@/entities/artwork";
import { FeedSearchInput, useFeedSearch } from "@/features/feed-search";
import { LikeButton } from "@/features/like-artwork";
import { FeedHeader } from "@/widgets/feed-header";

export default function FeedPage() {
  const { query, setQuery, filteredItems } = useFeedSearch(MOCK_ARTWORKS);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-sky-100/70 via-white to-teal-50/60">
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/4 -left-32 h-[35rem] w-[35rem] rounded-full bg-sky-200/30 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 -right-24 h-[40rem] w-[40rem] rounded-full bg-teal-100/40 blur-3xl"
      />

      <div className="relative z-10 flex min-h-screen w-full flex-col">
        <FeedHeader />

        <main className="mx-auto w-full max-w-6xl flex-1 px-8 py-8 flex flex-col items-center">

          <FeedSearchInput value={query} onChange={setQuery} />

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 justify-items-center w-full">
            {filteredItems.map((artwork) => (
              <ArtworkCard key={artwork.id} artwork={artwork} likeSlot={<LikeButton />} />
            ))}
          </div>

          {filteredItems.length === 0 && (
            <div className="text-center py-24 text-xs text-gray-400">
              검색 결과와 일치하는 작품이 없습니다.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
