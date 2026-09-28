export function ArtworkCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex min-h-[280px] w-full max-w-[360px] flex-col justify-between rounded-[26px] bg-white/80 p-3 shadow-sm ring-1 ring-black/[0.03] backdrop-blur-sm sm:p-4"
    >
      <div className="flex flex-1 animate-pulse items-center justify-center rounded-[18px] border border-gray-100/50 bg-gray-50/80">
        <div className="h-20 w-20 rounded-[18px] bg-gray-200/80" />
      </div>

      <div className="mt-3 flex items-end justify-between px-1 pb-0.5">
        <div className="animate-pulse">
          <div className="h-3 w-28 rounded-full bg-gray-200" />
          <div className="mt-2 h-2.5 w-16 rounded-full bg-gray-100" />
        </div>

        <div className="h-6 w-6 animate-pulse rounded-full bg-gray-200" />
      </div>
    </div>
  );
}
