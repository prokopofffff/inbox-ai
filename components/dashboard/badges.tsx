import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Category, Priority, Sentiment } from "@/lib/types";

/**
 * Dashboard-local status badges.
 *
 * These mirror the semantic palette from the design system (priority,
 * sentiment, category) but are kept self-contained within the dashboard
 * feature so this route has no cross-feature import coupling. Colors follow
 * the design tokens: Priority URGENT/HIGH → red/orange, MEDIUM → amber,
 * LOW → slate; Sentiment POSITIVE → emerald, NEUTRAL → slate,
 * NEGATIVE → rose.
 */

// Priority: High/Urgent=danger(red), Medium=warning(amber), Low=success(green).
const priorityStyles: Record<Priority, string> = {
  URGENT:
    "border-transparent bg-[var(--danger-subtle)] text-[var(--danger)]",
  HIGH: "border-transparent bg-[var(--danger-subtle)] text-[var(--danger)]",
  MEDIUM:
    "border-transparent bg-[var(--warning-subtle)] text-[var(--warning)]",
  LOW: "border-transparent bg-[var(--success-subtle)] text-[var(--success)]",
};

/** Small dot colors used inline next to priority labels (matches design). */
export const PRIORITY_DOT: Record<Priority, string> = {
  URGENT: "bg-[var(--danger)]",
  HIGH: "bg-[var(--danger)]",
  MEDIUM: "bg-[var(--warning)]",
  LOW: "bg-[var(--success)]",
};

const priorityLabel: Record<Priority, string> = {
  URGENT: "Urgent",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

export function PriorityBadge({
  priority,
  className,
}: {
  priority: Priority;
  className?: string;
}) {
  return (
    <Badge className={cn("gap-1.5", priorityStyles[priority], className)}>
      <span
        aria-hidden
        className={cn("size-1.5 rounded-full", PRIORITY_DOT[priority])}
      />
      {priorityLabel[priority]}
    </Badge>
  );
}

// Sentiment: Positive=success(green), Neutral=slate/secondary, Negative=danger(red).
const sentimentStyles: Record<Sentiment, string> = {
  POSITIVE:
    "border-transparent bg-[var(--success-subtle)] text-[var(--success)]",
  NEUTRAL:
    "border-transparent bg-[var(--bg-subtle)] text-[var(--text-secondary)]",
  NEGATIVE:
    "border-transparent bg-[var(--danger-subtle)] text-[var(--danger)]",
};

const sentimentLabel: Record<Sentiment, string> = {
  POSITIVE: "Positive",
  NEUTRAL: "Neutral",
  NEGATIVE: "Negative",
};

export function SentimentBadge({
  sentiment,
  className,
}: {
  sentiment: Sentiment;
  className?: string;
}) {
  return (
    <Badge className={cn(sentimentStyles[sentiment], className)}>
      {sentimentLabel[sentiment]}
    </Badge>
  );
}

// Category chips = subtle tinted backgrounds mapped to the token palette.
const categoryStyles: Record<Category, string> = {
  SUPPORT:
    "border-transparent bg-[var(--accent-subtle)] text-[var(--accent)]",
  SALES:
    "border-transparent bg-[var(--purple-subtle)] text-[var(--purple)]",
  BILLING:
    "border-transparent bg-[var(--warning-subtle)] text-[var(--warning)]",
  SPAM: "border-transparent bg-[var(--bg-subtle)] text-[var(--text-secondary)]",
  GENERAL:
    "border-transparent bg-[var(--success-subtle)] text-[var(--success)]",
  INTERNAL:
    "border-transparent bg-[var(--purple-subtle)] text-[var(--purple)]",
};

const categoryLabel: Record<Category, string> = {
  SUPPORT: "Support",
  SALES: "Sales",
  BILLING: "Billing",
  SPAM: "Spam",
  GENERAL: "General",
  INTERNAL: "Internal",
};

export function CategoryBadge({
  category,
  className,
}: {
  category: Category;
  className?: string;
}) {
  return (
    <Badge className={cn(categoryStyles[category], className)}>
      {categoryLabel[category]}
    </Badge>
  );
}
