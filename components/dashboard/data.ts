import "server-only";

import { prisma } from "@/lib/prisma";
import { hasDatabase } from "@/lib/env";
import { getMockEmails } from "@/lib/mock-emails";
import {
  CATEGORY_VALUES,
  PRIORITY_VALUES,
  SENTIMENT_VALUES,
} from "@/lib/schemas";
import {
  CATEGORY_LABEL,
  PRIORITY_LABEL,
  SENTIMENT_LABEL,
} from "@/lib/labels";
import type {
  Category,
  ChartDatum,
  DashboardData,
  EmailWithClassification,
  Priority,
  Sentiment,
  TimeSeriesDatum,
} from "@/lib/types";
import {
  CATEGORY_COLORS,
  PRIORITY_COLORS,
} from "@/components/dashboard/palette";

/**
 * Dashboard data access.
 *
 * `getDashboardData()` computes headline stats + chart datasets + recent
 * activity from Prisma. When no database is configured (local dev without
 * credentials) it degrades gracefully to deterministic mock data so the route
 * still renders. Any query error also falls back to mock data rather than
 * crashing the page.
 */

const HOURS_WINDOW = 24;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function startOfTodayUTC(now = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

function pctDelta(current: number, previous: number): number {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

/** Build empty (zero-filled) hourly buckets for the last 24h, oldest first. */
function emptyHourlyBuckets(now = new Date()): TimeSeriesDatum[] {
  const buckets: TimeSeriesDatum[] = [];
  const base = new Date(now);
  base.setMinutes(0, 0, 0);
  for (let i = HOURS_WINDOW - 1; i >= 0; i--) {
    const d = new Date(base.getTime() - i * HOUR_MS);
    const label = `${d.getHours().toString().padStart(2, "0")}:00`;
    buckets.push({ date: label, count: 0 });
  }
  return buckets;
}

export async function getDashboardData(): Promise<DashboardData> {
  if (!hasDatabase) return mockDashboardData();
  try {
    return await queryDashboardData();
  } catch (err) {
    console.error("[dashboard] falling back to mock data:", err);
    return mockDashboardData();
  }
}

async function queryDashboardData(): Promise<DashboardData> {
  const now = new Date();
  const todayStart = startOfTodayUTC(now);
  const yesterdayStart = new Date(todayStart.getTime() - DAY_MS);
  const windowStart = new Date(now.getTime() - HOURS_WINDOW * HOUR_MS);

  const [
    totalToday,
    totalYesterday,
    urgentCount,
    urgentYesterday,
    unreadCount,
    resolvedToday,
    resolvedYesterday,
    categoryGroups,
    priorityGroups,
    sentimentGroups,
    windowEmails,
    recent,
  ] = await Promise.all([
    prisma.email.count({ where: { receivedAt: { gte: todayStart } } }),
    prisma.email.count({
      where: { receivedAt: { gte: yesterdayStart, lt: todayStart } },
    }),
    prisma.email.count({
      where: {
        status: { not: "ARCHIVED" },
        classification: { priority: { in: ["HIGH", "URGENT"] } },
      },
    }),
    prisma.email.count({
      where: {
        receivedAt: { gte: yesterdayStart, lt: todayStart },
        classification: { priority: { in: ["HIGH", "URGENT"] } },
      },
    }),
    prisma.email.count({ where: { status: "UNREAD" } }),
    prisma.email.count({
      where: { status: "ARCHIVED", receivedAt: { gte: todayStart } },
    }),
    prisma.email.count({
      where: {
        status: "ARCHIVED",
        receivedAt: { gte: yesterdayStart, lt: todayStart },
      },
    }),
    prisma.classification.groupBy({
      by: ["category"],
      _count: { _all: true },
    }),
    prisma.classification.groupBy({
      by: ["priority"],
      _count: { _all: true },
    }),
    prisma.classification.groupBy({
      by: ["sentiment"],
      _count: { _all: true },
    }),
    prisma.email.findMany({
      where: { receivedAt: { gte: windowStart } },
      select: { receivedAt: true },
    }),
    prisma.email.findMany({
      where: { classification: { isNot: null } },
      orderBy: { receivedAt: "desc" },
      take: 8,
      include: {
        classification: true,
        assignee: true,
        mailbox: true,
      },
    }),
  ]);

  const avgAgg = await prisma.classification.aggregate({
    _avg: { confidence: true },
  });

  // Category / priority / sentiment datasets (always show all buckets).
  const categoryMap = new Map(
    categoryGroups.map((g) => [g.category as Category, g._count._all]),
  );
  const byCategory: ChartDatum[] = CATEGORY_VALUES.map((c) => ({
    name: CATEGORY_LABEL[c],
    value: categoryMap.get(c) ?? 0,
    color: CATEGORY_COLORS[c],
  }));

  const priorityMap = new Map(
    priorityGroups.map((g) => [g.priority as Priority, g._count._all]),
  );
  const byPriority: ChartDatum[] = PRIORITY_VALUES.map((p) => ({
    name: PRIORITY_LABEL[p],
    value: priorityMap.get(p) ?? 0,
    color: PRIORITY_COLORS[p],
  }));

  const sentimentMap = new Map(
    sentimentGroups.map((g) => [g.sentiment as Sentiment, g._count._all]),
  );
  const bySentiment: ChartDatum[] = SENTIMENT_VALUES.map((s) => ({
    name: SENTIMENT_LABEL[s],
    value: sentimentMap.get(s) ?? 0,
  }));

  // Hourly volume buckets.
  const buckets = emptyHourlyBuckets(now);
  const baseHour = new Date(now);
  baseHour.setMinutes(0, 0, 0);
  const oldestBucketMs = baseHour.getTime() - (HOURS_WINDOW - 1) * HOUR_MS;
  for (const e of windowEmails) {
    const idx = Math.floor((e.receivedAt.getTime() - oldestBucketMs) / HOUR_MS);
    if (idx >= 0 && idx < buckets.length) buckets[idx].count += 1;
  }

  return {
    stats: {
      totalEmails: totalToday,
      unread: unreadCount,
      urgent: urgentCount,
      openTasks: resolvedToday,
      avgConfidence: avgAgg._avg.confidence ?? 0,
      deltas: {
        totalEmails: pctDelta(totalToday, totalYesterday),
        urgent: pctDelta(urgentCount, urgentYesterday),
        openTasks: pctDelta(resolvedToday, resolvedYesterday),
      },
    },
    volumeByDay: buckets,
    byCategory,
    byPriority,
    bySentiment,
    recentEmails: recent.map(mapRecent),
  };
}

/**
 * Maps a Prisma email row (with classification + assignee + mailbox included)
 * to the serializable `EmailWithClassification` view model consumed by the UI.
 * The parameter shape is a structural subset of the Prisma result.
 */
function mapRecent(e: {
  id: string;
  gmailId: string;
  threadId: string | null;
  fromAddr: string;
  fromName: string | null;
  toAddr: string | null;
  subject: string | null;
  snippet: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  receivedAt: Date;
  status: EmailWithClassification["status"];
  assigneeId: string | null;
  mailboxId: string;
  classification: {
    id: string;
    emailId: string;
    category: Category;
    priority: Priority;
    summary: string;
    suggestedReply: string;
    sentiment: Sentiment;
    confidence: number;
    assignee: string | null;
    model: string | null;
    createdAt: Date;
  } | null;
  assignee: {
    id: string;
    email: string;
    name: string | null;
    role: string;
  } | null;
  mailbox: { id: string; email: string; provider: string } | null;
}): EmailWithClassification {
  return {
    id: e.id,
    gmailId: e.gmailId,
    threadId: e.threadId,
    fromAddr: e.fromAddr,
    fromName: e.fromName,
    toAddr: e.toAddr,
    subject: e.subject,
    snippet: e.snippet,
    bodyText: e.bodyText,
    bodyHtml: e.bodyHtml,
    receivedAt: e.receivedAt,
    status: e.status,
    assigneeId: e.assigneeId,
    mailboxId: e.mailboxId,
    classification: e.classification
      ? {
          id: e.classification.id,
          emailId: e.classification.emailId,
          category: e.classification.category,
          priority: e.classification.priority,
          summary: e.classification.summary,
          suggestedReply: e.classification.suggestedReply,
          sentiment: e.classification.sentiment,
          confidence: e.classification.confidence,
          assignee: e.classification.assignee,
          model: e.classification.model,
          createdAt: e.classification.createdAt,
        }
      : null,
    assignee: null,
    mailbox: e.mailbox
      ? {
          id: e.mailbox.id,
          email: e.mailbox.email,
          provider: e.mailbox.provider,
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Mock data (local dev / no database / query error)
// ---------------------------------------------------------------------------

function mockDashboardData(): DashboardData {
  const now = new Date();

  const categoryCounts: Record<Category, number> = {
    SUPPORT: 412,
    SALES: 286,
    BILLING: 198,
    GENERAL: 164,
    SPAM: 89,
    INTERNAL: 135,
  };
  const byCategory: ChartDatum[] = CATEGORY_VALUES.map((c) => ({
    name: CATEGORY_LABEL[c],
    value: categoryCounts[c],
    color: CATEGORY_COLORS[c],
  }));

  const priorityCounts: Record<Priority, number> = {
    URGENT: 47,
    HIGH: 312,
    MEDIUM: 604,
    LOW: 321,
  };
  const byPriority: ChartDatum[] = PRIORITY_VALUES.map((p) => ({
    name: PRIORITY_LABEL[p],
    value: priorityCounts[p],
    color: PRIORITY_COLORS[p],
  }));

  const sentimentCounts: Record<Sentiment, number> = {
    POSITIVE: 528,
    NEUTRAL: 611,
    NEGATIVE: 145,
  };
  const bySentiment: ChartDatum[] = SENTIMENT_VALUES.map((s) => ({
    name: SENTIMENT_LABEL[s],
    value: sentimentCounts[s],
  }));

  // Deterministic-ish hourly curve peaking during working hours.
  const buckets = emptyHourlyBuckets(now).map((b, i) => {
    const hour = Number(b.date.slice(0, 2));
    const base = 14 + Math.round(30 * Math.max(0, Math.sin((hour / 24) * Math.PI)));
    const jitter = ((i * 37) % 11) - 5;
    return { date: b.date, count: Math.max(0, base + jitter) };
  });

  // Reuse the shared mock inbox so dashboard "recent activity" links resolve to
  // real detail pages in mock mode.
  const recentEmails: EmailWithClassification[] = getMockEmails(now);

  return {
    stats: {
      totalEmails: 1284,
      unread: 23,
      urgent: 47,
      openTasks: 892,
      avgConfidence: 0.93,
      deltas: {
        totalEmails: 12,
        urgent: 8,
        unread: -5,
        openTasks: 18,
      },
    },
    volumeByDay: buckets,
    byCategory,
    byPriority,
    bySentiment,
    recentEmails,
  };
}
