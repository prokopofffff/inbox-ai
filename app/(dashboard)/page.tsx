import { Suspense } from "react";
import { Download, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatCards, StatCardsSkeleton } from "@/components/dashboard/stat-cards";
import {
  CategoryBarChart,
  ChartSkeleton,
  PriorityDonutChart,
} from "@/components/dashboard/charts";
import {
  RecentActivity,
  RecentActivitySkeleton,
} from "@/components/dashboard/recent-activity";
import { getDashboardData } from "@/components/dashboard/data";

export const metadata = {
  title: "Dashboard · Inbox AI",
  description: "AI-powered triage overview for your team inbox.",
};

// Always compute fresh stats on request.
export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <PageHeader />
      {/* One Suspense boundary: all sections share the same data fetch. */}
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}

function PageHeader() {
  return (
    <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
          Dashboard
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          AI-powered triage overview for your team inbox
        </p>
      </div>
      <div className="flex items-center gap-2.5">
        <Button variant="outline" size="lg">
          <Download className="size-4" aria-hidden />
          Export
        </Button>
        <Button size="lg">
          <RefreshCw className="size-4" aria-hidden />
          Refresh
        </Button>
      </div>
    </header>
  );
}

async function DashboardContent() {
  const data = await getDashboardData();

  return (
    <div className="flex flex-col gap-6">
      <StatCards stats={data.stats} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CategoryBarChart data={data.byCategory} />
        <PriorityDonutChart data={data.byPriority} />
      </div>

      <RecentActivity emails={data.recentEmails} />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <StatCardsSkeleton />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
      <RecentActivitySkeleton />
    </div>
  );
}
