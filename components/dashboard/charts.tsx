"use client";

import * as React from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import { Skeleton } from "@/components/ui/skeleton";
import { ACCENT } from "@/components/dashboard/palette";
import type { ChartDatum } from "@/lib/types";

/**
 * Dashboard charts.
 *
 * - "Emails by Category" is a lightweight horizontal bar list (no charting
 *   library needed) matching the design reference.
 * - "Priority Distribution" is a Recharts donut with a center total and a
 *   High / Medium / Low legend (red / amber / green).
 *
 * Colors are passed in per-datum (`datum.color`) by the server so the palette
 * stays centralized.
 */

// ---------------------------------------------------------------------------
// Category horizontal bar list
// ---------------------------------------------------------------------------

export function CategoryBarChart({ data }: { data: ChartDatum[] }) {
  const rows = React.useMemo(
    () => data.filter((d) => d.value > 0).sort((a, b) => b.value - a.value),
    [data],
  );
  const max = React.useMemo(
    () => rows.reduce((m, d) => Math.max(m, d.value), 0),
    [rows],
  );

  return (
    <PanelCard
      title="Emails by Category"
      description="Distribution across triage labels"
      isEmpty={rows.length === 0}
    >
      <div className="flex w-full flex-col gap-4">
        {rows.map((row) => (
          <div key={row.name} className="flex w-full flex-col gap-[7px]">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-[var(--text-primary)]">
                {row.name}
              </span>
              <span className="text-[13px] font-medium tabular-nums text-[var(--text-secondary)]">
                {row.value.toLocaleString()}
              </span>
            </div>
            <div className="h-[9px] w-full overflow-hidden rounded-full bg-[var(--bg-hover)]">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${max > 0 ? Math.max((row.value / max) * 100, 4) : 0}%`,
                  backgroundColor: row.color ?? ACCENT,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </PanelCard>
  );
}

// ---------------------------------------------------------------------------
// Priority donut chart
// ---------------------------------------------------------------------------

export function PriorityDonutChart({ data }: { data: ChartDatum[] }) {
  // Collapse to the three display buckets the design shows (High / Medium /
  // Low). "Urgent" folds into "High" so the segments + total line up.
  const segments = React.useMemo(() => {
    const find = (name: string) =>
      data.filter((d) => d.name === name).reduce((s, d) => s + d.value, 0);
    return [
      { name: "High", value: find("Urgent") + find("High"), color: "#dc2626" },
      { name: "Medium", value: find("Medium"), color: "#d97706" },
      { name: "Low", value: find("Low"), color: "#16a34a" },
    ].filter((s) => s.value > 0 || data.length > 0);
  }, [data]);

  const total = React.useMemo(
    () => segments.reduce((sum, d) => sum + d.value, 0),
    [segments],
  );

  return (
    <PanelCard
      title="Priority Distribution"
      description="How incoming email is prioritized"
      isEmpty={total === 0}
    >
      <div className="flex w-full flex-col items-center gap-7 py-2 sm:flex-row sm:justify-center">
        <div className="relative size-[172px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={segments}
                dataKey="value"
                nameKey="name"
                innerRadius={62}
                outerRadius={86}
                startAngle={90}
                endAngle={-270}
                stroke="none"
              >
                {segments.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-px">
            <span className="text-[26px] leading-none font-semibold tracking-[-0.02em] tabular-nums text-[var(--text-primary)]">
              {total.toLocaleString()}
            </span>
            <span className="text-xs font-medium text-[var(--text-tertiary)]">
              Total
            </span>
          </div>
        </div>
        <ul className="flex w-full flex-col gap-4 sm:flex-1">
          {segments.map((entry) => {
            const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0;
            return (
              <li
                key={entry.name}
                className="flex items-center gap-2.5"
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: entry.color }}
                  aria-hidden
                />
                <span className="flex-1 text-sm font-medium text-[var(--text-primary)]">
                  {entry.name}
                </span>
                <span className="text-sm font-semibold tabular-nums text-[var(--text-primary)]">
                  {pct}%
                </span>
                <span className="text-[13px] tabular-nums text-[var(--text-tertiary)]">
                  {entry.value.toLocaleString()}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </PanelCard>
  );
}

// ---------------------------------------------------------------------------
// Shared panel wrapper + empty/loading states
// ---------------------------------------------------------------------------

function PanelCard({
  title,
  description,
  isEmpty,
  children,
}: {
  title: string;
  description: string;
  isEmpty?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-[var(--border)] bg-card p-6 shadow-[0px_1px_2px_0px_#1018280F,_0px_4px_12px_-2px_#1018280A]">
      <div className="flex flex-col gap-[3px]">
        <h3 className="text-base font-semibold tracking-[-0.01em] text-[var(--text-primary)]">
          {title}
        </h3>
        <p className="text-[13px] text-[var(--text-secondary)]">{description}</p>
      </div>
      {isEmpty ? (
        <div className="flex h-[172px] flex-col items-center justify-center gap-1 text-center">
          <p className="text-sm font-medium text-[var(--text-primary)]">
            No data yet
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            Charts populate as emails are classified.
          </p>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={
        "flex flex-col gap-5 rounded-2xl border border-[var(--border)] bg-card p-6 shadow-[0px_1px_2px_0px_#1018280F,_0px_4px_12px_-2px_#1018280A] " +
        (className ?? "")
      }
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      <Skeleton className="h-[172px] w-full" />
    </div>
  );
}
