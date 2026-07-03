import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import {
  PriorityBadge,
  SentimentBadge,
  CategoryBadge,
  PRIORITY_DOT,
} from "@/components/dashboard/badges";
import {
  PRIORITY_VALUES,
  SENTIMENT_VALUES,
  CATEGORY_VALUES,
} from "@/lib/schemas";

/**
 * dashboard/badges.tsx mirrors the semantic palette but self-contained. Priority
 * badges carry a leading colored dot (PRIORITY_DOT); Sentiment/Category are flat.
 */

describe("dashboard/badges PriorityBadge", () => {
  const cases: Array<[(typeof PRIORITY_VALUES)[number], string, string]> = [
    ["URGENT", "Urgent", "text-[var(--danger)]"],
    ["HIGH", "High", "text-[var(--danger)]"],
    ["MEDIUM", "Medium", "text-[var(--warning)]"],
    ["LOW", "Low", "text-[var(--success)]"],
  ];

  it.each(cases)(
    "renders %s label + color + dot color",
    (value, label, colorClass) => {
      const { container } = render(<PriorityBadge priority={value} />);
      const el = screen.getByText(label);
      expect(el.className).toContain(colorClass);
      const dotEl = container.querySelector("span[aria-hidden]");
      expect(dotEl!.className).toContain(PRIORITY_DOT[value]);
    },
  );

  it("PRIORITY_DOT maps High/Urgent to danger, Medium to warning, Low to success", () => {
    expect(PRIORITY_DOT.URGENT).toBe("bg-[var(--danger)]");
    expect(PRIORITY_DOT.HIGH).toBe("bg-[var(--danger)]");
    expect(PRIORITY_DOT.MEDIUM).toBe("bg-[var(--warning)]");
    expect(PRIORITY_DOT.LOW).toBe("bg-[var(--success)]");
  });
});

describe("dashboard/badges SentimentBadge", () => {
  const cases: Array<[(typeof SENTIMENT_VALUES)[number], string, string]> = [
    ["POSITIVE", "Positive", "text-[var(--success)]"],
    ["NEUTRAL", "Neutral", "text-[var(--text-secondary)]"],
    ["NEGATIVE", "Negative", "text-[var(--danger)]"],
  ];

  it.each(cases)("renders %s label + color", (value, label, colorClass) => {
    render(<SentimentBadge sentiment={value} />);
    expect(screen.getByText(label).className).toContain(colorClass);
  });

  it("covers every Sentiment enum value", () => {
    expect(cases.map((c) => c[0]).sort()).toEqual([...SENTIMENT_VALUES].sort());
  });
});

describe("dashboard/badges CategoryBadge", () => {
  const labels: Record<(typeof CATEGORY_VALUES)[number], string> = {
    SUPPORT: "Support",
    SALES: "Sales",
    BILLING: "Billing",
    SPAM: "Spam",
    GENERAL: "General",
    INTERNAL: "Internal",
  };

  it.each(CATEGORY_VALUES)("renders %s label", (value) => {
    render(<CategoryBadge category={value} />);
    expect(screen.getByText(labels[value])).toBeInTheDocument();
  });
});
