import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  CATEGORY_LABEL,
  PRIORITY_LABEL,
  SENTIMENT_LABEL,
  STATUS_LABEL,
} from "@/lib/labels";
import type {
  Category,
  EmailStatus,
  Priority,
  Sentiment,
  TaskStatus,
} from "@/lib/types";

/**
 * Enum -> colored Badge helpers.
 *
 * Priority and Sentiment use the semantic `data-tone` palette defined in
 * globals.css. Category and Status use the built-in shadcn Badge variants for
 * a neutral, consistent look.
 */

type BadgeProps = Omit<React.ComponentProps<typeof Badge>, "variant">;

// ---------------------------------------------------------------------------
// Priority
// ---------------------------------------------------------------------------

const PRIORITY_TONE: Record<Priority, string> = {
  URGENT: "urgent",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
};

export function PriorityBadge({
  priority,
  className,
  ...props
}: BadgeProps & { priority: Priority }) {
  return (
    <Badge
      variant="secondary"
      data-tone={PRIORITY_TONE[priority]}
      className={cn("border-transparent", className)}
      {...props}
    >
      {PRIORITY_LABEL[priority]}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Sentiment
// ---------------------------------------------------------------------------

const SENTIMENT_TONE: Record<Sentiment, string> = {
  POSITIVE: "positive",
  NEUTRAL: "neutral",
  NEGATIVE: "negative",
};

export function SentimentBadge({
  sentiment,
  className,
  ...props
}: BadgeProps & { sentiment: Sentiment }) {
  return (
    <Badge
      variant="secondary"
      data-tone={SENTIMENT_TONE[sentiment]}
      className={cn("border-transparent", className)}
      {...props}
    >
      {SENTIMENT_LABEL[sentiment]}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Category
// ---------------------------------------------------------------------------

// Category chips = subtle tinted backgrounds from the token palette.
const CATEGORY_STYLES: Record<Category, string> = {
  SUPPORT: "border-transparent bg-[var(--accent-subtle)] text-[var(--accent)]",
  SALES: "border-transparent bg-[var(--purple-subtle)] text-[var(--purple)]",
  BILLING:
    "border-transparent bg-[var(--warning-subtle)] text-[var(--warning)]",
  SPAM: "border-transparent bg-[var(--bg-subtle)] text-[var(--text-secondary)]",
  GENERAL:
    "border-transparent bg-[var(--success-subtle)] text-[var(--success)]",
  INTERNAL:
    "border-transparent bg-[var(--purple-subtle)] text-[var(--purple)]",
};

export function CategoryBadge({
  category,
  className,
  ...props
}: BadgeProps & { category: Category }) {
  return (
    <Badge
      variant="secondary"
      className={cn(CATEGORY_STYLES[category], className)}
      {...props}
    >
      {CATEGORY_LABEL[category]}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Status (email + task)
// ---------------------------------------------------------------------------

type AnyStatus = EmailStatus | TaskStatus;

const STATUS_VARIANT: Record<
  AnyStatus,
  React.ComponentProps<typeof Badge>["variant"]
> = {
  UNREAD: "default",
  READ: "secondary",
  ARCHIVED: "outline",
  OPEN: "default",
  IN_PROGRESS: "secondary",
  DONE: "outline",
};

export function StatusBadge({
  status,
  className,
  ...props
}: BadgeProps & { status: AnyStatus }) {
  return (
    <Badge
      variant={STATUS_VARIANT[status]}
      className={className}
      {...props}
    >
      {STATUS_LABEL[status]}
    </Badge>
  );
}
