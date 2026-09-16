"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, CircleUserRound } from "lucide-react";
import { PistonLogo } from "@/shared/ui";
import { ArtworkCard, MOCK_ARTWORKS } from "@/entities/artwork";

function FeedHeader() {
  return (
    <header className="sticky top-0 z-20 grid w-full grid-cols-3 items-center px-12 py-4 bg-white/85 backdrop-blur-sm">
      <span className="justify-self-start">
        <PistonLogo />
      </span>

      <nav className="flex w-full max-w-[200px] justify-self-center items-center justify-between text-sm font-medium text-gray-700">
        <Link href="/create" className="transition-colors hover:text-gray-950">
          Create
        </Link>
        <Link href="/feed" className="font-semibold text-blue-500">
          Feed
        </Link>
      </nav>

      <Link href="/login" className="justify-self-end text-gray-900 transition-colors hover:text-gray-600">
        <CircleUserRound className="h-8 w-8" strokeWidth={1.25} />
      </Link>
    </header>
  );
}

export default function FeedPage() {
  const [query, setQuery] = useState("");

  const filteredItems = MOCK_ARTWORKS.filter((artwork) => {
    const normalizedQuery = query.replace(/\s+/g, "").toLowerCase();
    const normalizedTitle = artwork.title.replace(/\s+/g, "").toLowerCase();
    const normalizedAuthor = artwork.author.replace(/\s+/g, "").toLowerCase();

    return (
      normalizedTitle.includes(normalizedQuery) ||
      normalizedAuthor.includes(normalizedQuery)
    );
  });

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

          <div className="mb-12 w-[400px] h-[48px]">
            <div className="flex w-full h-full items-center justify-between rounded-[20px] bg-white pl-6 pr-6 py-2 shadow-sm ring-1 ring-black/[0.04] opacity-100 rotate-0">
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="검색어를 입력하세요."
                className="w-full bg-transparent text-xs text-gray-700 placeholder:text-gray-300 focus:outline-none"
              />
              <button type="button" aria-label="검색" className="text-gray-400">
                <Search className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 justify-items-center w-full">
            {filteredItems.map((artwork) => (
              <ArtworkCard key={artwork.id} artwork={artwork} />
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
