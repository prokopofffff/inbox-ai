import { Skeleton } from "@/components/ui/skeleton";

export default function InboxLoading() {
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
        {/* LEFT list pane */}
        <div className="flex w-full flex-col lg:w-[360px] lg:shrink-0 lg:border-r lg:border-[var(--border)]">
          {/* Tabs */}
          <div className="flex shrink-0 gap-1.5 border-b border-[var(--border)] px-4 py-2.5">
            <Skeleton className="h-8 w-14 rounded-lg" />
            <Skeleton className="h-8 w-16 rounded-lg" />
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
          {/* Search */}
          <div className="shrink-0 border-b border-[var(--border)] px-4 py-2.5">
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
          {/* Rows */}
          <div className="min-h-0 flex-1 overflow-hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="space-y-2 border-b border-[var(--border)] py-3.5 pr-4 pl-5"
              >
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-6" />
                </div>
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <div className="flex gap-1.5 pt-0.5">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-6 w-14 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CENTER placeholder */}
        <div className="hidden flex-1 items-center justify-center bg-[var(--bg-subtle)] lg:flex">
          <Skeleton className="size-12 rounded-full" />
        </div>
      </div>
    </div>
  );
}
