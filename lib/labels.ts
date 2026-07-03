import type {
  Category,
  EmailStatus,
  Priority,
  Sentiment,
  TaskStatus,
} from "@/lib/types";

/**
 * Single source of truth for enum -> human label mappings.
 *
 * These display strings were previously duplicated across badges, filters,
 * the email list/detail views, and the dashboard data layer. Import from here
 * so a label change happens in exactly one place.
 */

export const PRIORITY_LABEL: Record<Priority, string> = {
  URGENT: "Urgent",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

export const SENTIMENT_LABEL: Record<Sentiment, string> = {
  POSITIVE: "Positive",
  NEUTRAL: "Neutral",
  NEGATIVE: "Negative",
};

export const CATEGORY_LABEL: Record<Category, string> = {
  SUPPORT: "Support",
  SALES: "Sales",
  BILLING: "Billing",
  SPAM: "Spam",
  GENERAL: "General",
  INTERNAL: "Internal",
};

export const STATUS_LABEL: Record<EmailStatus | TaskStatus, string> = {
  UNREAD: "Unread",
  READ: "Read",
  ARCHIVED: "Archived",
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  DONE: "Done",
};
