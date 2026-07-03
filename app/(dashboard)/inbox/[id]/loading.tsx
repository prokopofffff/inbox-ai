import { Skeleton } from "@/components/ui/skeleton";

export default function EmailDetailLoading() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--bg-card)]">
      {/* Header */}
      <div className="flex shrink-0 flex-col gap-1 border-b border-[var(--border)] px-7 py-4">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-4 w-56" />
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* LEFT list pane (desktop) */}
        <div className="hidden w-[360px] shrink-0 flex-col border-r border-[var(--border)] lg:flex">
          <div className="flex shrink-0 gap-1.5 border-b border-[var(--border)] px-4 py-2.5">
            <Skeleton className="h-8 w-14 rounded-lg" />
            <Skeleton className="h-8 w-16 rounded-lg" />
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
          <div className="shrink-0 border-b border-[var(--border)] px-4 py-2.5">
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="space-y-2 border-b border-[var(--border)] py-3.5 pr-4 pl-5"
              >
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-6" />
                </div>
                <Skeleton className="h-3.5 w-3/4" />
                <div className="flex gap-1.5 pt-0.5">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-6 w-14 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CENTER + RIGHT */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col xl:flex-row">
          {/* Center */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="shrink-0 space-y-2 border-b border-[var(--border)] px-7 py-4">
              <Skeleton className="h-5 w-2/3" />
              <div className="flex items-center gap-2.5">
                <Skeleton className="size-7 rounded-full" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
            <div className="min-h-0 flex-1 space-y-5 overflow-hidden px-7 py-6">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-40 w-full rounded-xl" />
            </div>
            <div className="flex shrink-0 gap-2.5 border-t border-[var(--border)] px-7 py-3.5">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>

          {/* Right rail */}
          <aside className="shrink-0 space-y-[18px] border-t border-[var(--border)] bg-[var(--bg-subtle)] p-6 xl:w-[300px] xl:border-t-0 xl:border-l">
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </aside>
        </div>
      </div>
    </div>
  );
}
