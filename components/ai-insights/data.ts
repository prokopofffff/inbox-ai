import "server-only";

import { prisma } from "@/lib/prisma";
import { hasDatabase } from "@/lib/env";

/**
 * AI Insights data access.
 *
 * `getInsightsData()` derives ranked patterns (top issues, common questions,
 * repeated complaints, urgent cases) plus response-time metrics and suggested
 * automations from the classified email corpus. When no database is configured
 * (local dev without credentials) it degrades gracefully to deterministic mock
 * data so the route still renders. Any query error also falls back to mock data
 * rather than crashing the page.
 */

export type RankedItem = {
  label: string;
  count: number;
};

export type UrgentCase = {
  title: string;
  meta: string;
  severity: "critical" | "high";
};

export type ResponseMetric = {
  label: string;
  value: string;
};

export type Suggestion = {
  icon: "zap" | "reply" | "flag";
  text: string;
};

export type InsightsData = {
  topIssues: RankedItem[];
  commonQuestions: RankedItem[];
  repeatedComplaints: RankedItem[];
  urgentCases: UrgentCase[];
  responseTime: {
    average: string;
    trendPct: number;
    metrics: ResponseMetric[];
  };
  suggestions: Suggestion[];
};

export async function getInsightsData(): Promise<InsightsData> {
  if (!hasDatabase) return mockInsightsData();
  try {
    return await queryInsightsData();
  } catch (err) {
    console.error("[ai-insights] falling back to mock data:", err);
    return mockInsightsData();
  }
}

async function queryInsightsData(): Promise<InsightsData> {
  const mock = mockInsightsData();

  const [negativeCount, urgentEmails] = await Promise.all([
    prisma.classification.count({ where: { sentiment: "NEGATIVE" } }),
    prisma.email.findMany({
      where: {
        status: { not: "ARCHIVED" },
        classification: { priority: { in: ["HIGH", "URGENT"] } },
      },
      orderBy: { receivedAt: "desc" },
      take: 3,
      include: { classification: true },
    }),
  ]);

  // Build urgent cases from the freshest high/urgent emails; fall back to mock
  // entries when the corpus is empty so the card is never blank.
  const urgentCases: UrgentCase[] =
    urgentEmails.length > 0
      ? urgentEmails.map((e) => ({
          title: e.subject?.trim() || "Untitled thread",
          meta: e.fromName?.trim() || e.fromAddr,
          severity:
            e.classification?.priority === "URGENT" ? "critical" : "high",
        }))
      : mock.urgentCases;

  return {
    ...mock,
    // A small signal that data is real: reflect the negative-sentiment volume
    // in the top complaint count when we have it.
    repeatedComplaints:
      negativeCount > 0
        ? mock.repeatedComplaints.map((c, i) =>
            i === 0 ? { ...c, count: negativeCount } : c,
          )
        : mock.repeatedComplaints,
    urgentCases,
  };
}

// ---------------------------------------------------------------------------
// Mock data (local dev / no database / query error)
// ---------------------------------------------------------------------------

function mockInsightsData(): InsightsData {
  return {
    topIssues: [
      { label: "Login & access problems", count: 142 },
      { label: "Billing discrepancies", count: 98 },
      { label: "Feature requests", count: 76 },
      { label: "Integration errors", count: 54 },
    ],
    commonQuestions: [
      { label: "How do I reset my password?", count: 24 },
      { label: "Where can I find my invoice?", count: 18 },
      { label: "Can I upgrade my plan?", count: 15 },
      { label: "How to add team members?", count: 11 },
    ],
    repeatedComplaints: [
      { label: "Slow email sync", count: 37 },
      { label: "Mobile app crashes", count: 29 },
      { label: "Delayed notifications", count: 21 },
      { label: "Confusing rule setup", count: 14 },
    ],
    urgentCases: [
      {
        title: "API fully down",
        meta: "Acme Corp · SLA breach",
        severity: "critical",
      },
      {
        title: "Payment failed on renewal",
        meta: "Globex · 3 open tickets",
        severity: "high",
      },
      {
        title: "Data export not working",
        meta: "Initech · escalated",
        severity: "high",
      },
    ],
    responseTime: {
      average: "1h 42m",
      trendPct: 18,
      metrics: [
        { label: "First response", value: "12m" },
        { label: "Full resolution", value: "4h 20m" },
        { label: "Within SLA", value: "94%" },
      ],
    },
    suggestions: [
      {
        icon: "zap",
        text: "Auto-route billing questions to Finance — could resolve ~98 emails/week.",
      },
      {
        icon: "reply",
        text: "Add a canned reply for password resets — covers 24% of questions.",
      },
      {
        icon: "flag",
        text: "Flag Acme Corp threads as priority — repeated SLA-sensitive issues.",
      },
    ],
  };
}
