import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton for the AI Insights card grid. Mirrors the 3-column layout
 * and per-card header + body rhythm so the swap to real content is stable.
 */

function CardSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-[18px] rounded-2xl border border-border bg-card p-[22px] shadow-[0px_1px_2px_0px_#1018280F,_0px_4px_12px_-2px_#1018280A]">
      <div className="flex w-full items-center gap-3">
        <Skeleton className="size-[38px] rounded-lg" />
        <div className="flex flex-1 flex-col gap-1.5">
          <Skeleton className="h-3.5 w-2/5" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
      <div className="flex w-full flex-col gap-[15px]">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex w-full flex-col gap-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="h-3.5 w-8" />
            </div>
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function InsightsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <CardSkeleton key={i} rows={i > 2 ? 3 : 4} />
      ))}
    </div>
  );
}
