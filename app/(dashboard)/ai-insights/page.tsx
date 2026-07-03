import { Suspense } from "react";
import { Calendar, ChevronDown, Sparkles } from "lucide-react";

import { getInsightsData } from "@/components/ai-insights/data";
import {
  CommonQuestionsCard,
  RepeatedComplaintsCard,
  ResponseTimeCard,
  SuggestionsCard,
  TopIssuesCard,
  UrgentCasesCard,
} from "@/components/ai-insights/insight-cards";
import { InsightsSkeleton } from "@/components/ai-insights/skeleton";

export const metadata = {
  title: "AI Insights · Inbox AI",
  description: "Patterns and recommendations generated from your inbox.",
};

// Insights are derived from live aggregates; compute fresh per request.
export const dynamic = "force-dynamic";

export default function AiInsightsPage() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <PageHeader />
      <Suspense fallback={<InsightsSkeleton />}>
        <InsightsContent />
      </Suspense>
    </div>
  );
}

function PageHeader() {
  return (
    <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">AI Insights</h1>
        <p className="text-sm text-muted-foreground">
          Patterns and recommendations generated from your inbox
        </p>
      </div>
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg border border-border-strong bg-card px-3.5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-bg-hover"
        >
          <Calendar className="size-4 text-text-secondary" aria-hidden />
          Last 30 days
          <ChevronDown className="size-4 text-text-tertiary" aria-hidden />
        </button>
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white shadow-[0px_1px_2px_0px_#1018280F,_0px_4px_12px_-2px_#1018280A] transition-colors hover:bg-[#1D4ED8]"
        >
          <Sparkles className="size-4" aria-hidden />
          Ask AI
        </button>
      </div>
    </header>
  );
}

async function InsightsContent() {
  const data = await getInsightsData();

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <TopIssuesCard items={data.topIssues} />
      <CommonQuestionsCard items={data.commonQuestions} />
      <RepeatedComplaintsCard items={data.repeatedComplaints} />
      <UrgentCasesCard cases={data.urgentCases} />
      <ResponseTimeCard data={data.responseTime} />
      <SuggestionsCard items={data.suggestions} />
    </div>
  );
}
