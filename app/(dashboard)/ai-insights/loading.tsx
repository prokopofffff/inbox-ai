import { InsightsSkeleton } from "@/components/ai-insights/skeleton";

/**
 * Route-level loading UI for /ai-insights. Renders the header shell plus the
 * card-grid skeleton while the server component streams in.
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">AI Insights</h1>
          <p className="text-sm text-muted-foreground">
            Patterns and recommendations generated from your inbox
          </p>
        </div>
      </header>
      <InsightsSkeleton />
    </div>
  );
}
