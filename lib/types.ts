import type {
  Category,
  Priority,
  Sentiment,
  EmailStatus,
  TaskStatus,
  Role,
  RuleField,
  RuleOperator,
  RuleActionType,
} from "@/lib/schemas";

/**
 * Shared UI types.
 *
 * These are plain, serializable view models used across dashboard, inbox, and
 * automation screens. They intentionally do NOT import Prisma's generated
 * types so client components can consume them without pulling in the ORM.
 * Fields mirror the Prisma models (dates are represented as `Date` here; when
 * crossing the server/client boundary they may be serialized to ISO strings).
 */

// Re-export enum types for convenient single-import in UI code.
export type {
  Category,
  Priority,
  Sentiment,
  EmailStatus,
  TaskStatus,
  Role,
  RuleField,
  RuleOperator,
  RuleActionType,
};

export interface UserSummary {
  id: string;
  email: string;
  name: string | null;
  role: Role;
}

export interface MailboxSummary {
  id: string;
  email: string;
  provider: string;
}

export interface ClassificationView {
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
}

export interface EmailView {
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
  status: EmailStatus;
  assigneeId: string | null;
  mailboxId: string;
}

/** An email joined with its classification and (optionally) assignee. */
export interface EmailWithClassification extends EmailView {
  classification: ClassificationView | null;
  assignee: UserSummary | null;
  mailbox: MailboxSummary | null;
}

export interface TaskView {
  id: string;
  title: string;
  status: TaskStatus;
  dueAt: Date | null;
  emailId: string | null;
  assigneeId: string | null;
  assignee: UserSummary | null;
  createdAt: Date;
}

export interface AutomationRuleView {
  id: string;
  name: string;
  conditionField: RuleField;
  operator: RuleOperator;
  value: string;
  actionType: RuleActionType;
  actionValue: string;
  enabled: boolean;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Dashboard / charts
// ---------------------------------------------------------------------------

/** Headline metrics rendered as stat cards on the dashboard. */
export interface DashboardStats {
  totalEmails: number;
  unread: number;
  /** HIGH + URGENT open items. */
  urgent: number;
  openTasks: number;
  /** 0..1 average classifier confidence over the window. */
  avgConfidence: number;
  /** Percentage change vs. previous period, per metric (optional). */
  deltas?: Partial<
    Record<"totalEmails" | "unread" | "urgent" | "openTasks", number>
  >;
}

/** Generic single datum for Recharts (bar/line/pie). */
export interface ChartDatum {
  /** X-axis label or slice name. */
  name: string;
  value: number;
  /** Optional explicit fill (e.g. priority/sentiment palette). */
  color?: string;
}

/** Time-series point for the volume-over-time chart. */
export interface TimeSeriesDatum {
  /** ISO date (YYYY-MM-DD) or human label. */
  date: string;
  count: number;
}

export interface DashboardData {
  stats: DashboardStats;
  volumeByDay: TimeSeriesDatum[];
  byCategory: ChartDatum[];
  byPriority: ChartDatum[];
  bySentiment: ChartDatum[];
  recentEmails: EmailWithClassification[];
}

// ---------------------------------------------------------------------------
// Misc helpers
// ---------------------------------------------------------------------------

/** Standard async UI state discriminated union. */
export type AsyncState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "success"; data: T };

/** Result envelope returned by server actions. */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
