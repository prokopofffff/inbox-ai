import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import {
  PriorityBadge,
  SentimentBadge,
  CategoryBadge,
  StatusBadge,
} from "@/components/shared/badges";
import {
  PRIORITY_VALUES,
  SENTIMENT_VALUES,
  CATEGORY_VALUES,
  EMAIL_STATUS_VALUES,
  TASK_STATUS_VALUES,
} from "@/lib/schemas";

/**
 * shared/badges.tsx uses the semantic `data-tone` palette for Priority /
 * Sentiment and shadcn Badge variants + token classes for Category / Status.
 */

describe("shared/badges PriorityBadge", () => {
  const cases: Array<[(typeof PRIORITY_VALUES)[number], string, string]> = [
    ["URGENT", "Urgent", "urgent"],
    ["HIGH", "High", "high"],
    ["MEDIUM", "Medium", "medium"],
    ["LOW", "Low", "low"],
  ];

  it.each(cases)("renders %s with label + data-tone", (value, label, tone) => {
    render(<PriorityBadge priority={value} />);
    const el = screen.getByText(label);
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute("data-tone", tone);
    expect(el.className).toContain("border-transparent");
  });

  it("covers every Priority enum value", () => {
    expect(cases.map((c) => c[0]).sort()).toEqual([...PRIORITY_VALUES].sort());
  });

  it("forwards a custom className", () => {
    render(<PriorityBadge priority="HIGH" className="custom-x" />);
    expect(screen.getByText("High").className).toContain("custom-x");
  });
});

describe("shared/badges SentimentBadge", () => {
  const cases: Array<[(typeof SENTIMENT_VALUES)[number], string, string]> = [
    ["POSITIVE", "Positive", "positive"],
    ["NEUTRAL", "Neutral", "neutral"],
    ["NEGATIVE", "Negative", "negative"],
  ];

  it.each(cases)("renders %s with label + data-tone", (value, label, tone) => {
    render(<SentimentBadge sentiment={value} />);
    const el = screen.getByText(label);
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute("data-tone", tone);
  });

  it("covers every Sentiment enum value", () => {
    expect(cases.map((c) => c[0]).sort()).toEqual([...SENTIMENT_VALUES].sort());
  });
});

describe("shared/badges CategoryBadge", () => {
  const labels: Record<(typeof CATEGORY_VALUES)[number], string> = {
    SUPPORT: "Support",
    SALES: "Sales",
    BILLING: "Billing",
    SPAM: "Spam",
    GENERAL: "General",
    INTERNAL: "Internal",
  };
  // token color each category maps to (from CATEGORY_STYLES).
  const tokens: Record<(typeof CATEGORY_VALUES)[number], string> = {
    SUPPORT: "text-[var(--accent)]",
    SALES: "text-[var(--purple)]",
    BILLING: "text-[var(--warning)]",
    SPAM: "text-[var(--text-secondary)]",
    GENERAL: "text-[var(--success)]",
    INTERNAL: "text-[var(--purple)]",
  };

  it.each(CATEGORY_VALUES)("renders %s label + token color", (value) => {
    render(<CategoryBadge category={value} />);
    const el = screen.getByText(labels[value]);
    expect(el).toBeInTheDocument();
    expect(el.className).toContain(tokens[value]);
  });
});

describe("shared/badges StatusBadge", () => {
  const labels: Record<string, string> = {
    UNREAD: "Unread",
    READ: "Read",
    ARCHIVED: "Archived",
    OPEN: "Open",
    IN_PROGRESS: "In progress",
    DONE: "Done",
  };

  it.each([...EMAIL_STATUS_VALUES, ...TASK_STATUS_VALUES])(
    "renders %s label",
    (value) => {
      render(<StatusBadge status={value} />);
      expect(screen.getByText(labels[value])).toBeInTheDocument();
    },
  );
});
