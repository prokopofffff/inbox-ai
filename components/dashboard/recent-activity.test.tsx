import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import * as React from "react";

// Mock next/link so it renders a plain anchor in jsdom.
vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { RecentActivity } from "@/components/dashboard/recent-activity";
import type { EmailWithClassification } from "@/lib/types";

function makeEmail(
  overrides: Partial<EmailWithClassification> = {},
): EmailWithClassification {
  return {
    id: "e1",
    gmailId: "g1",
    threadId: null,
    fromAddr: "alice@example.com",
    fromName: "Alice Smith",
    toAddr: null,
    subject: "Need help with billing",
    snippet: null,
    bodyText: null,
    bodyHtml: null,
    receivedAt: new Date("2026-07-03T11:59:00Z"),
    status: "UNREAD",
    assigneeId: null,
    mailboxId: "m1",
    classification: {
      id: "c1",
      emailId: "e1",
      category: "BILLING",
      priority: "HIGH",
      summary: "Billing issue",
      suggestedReply: "We can help",
      sentiment: "NEUTRAL",
      confidence: 0.9,
      assignee: null,
      model: "gpt",
      createdAt: new Date("2026-07-03T12:00:00Z"),
    },
    assignee: null,
    mailbox: null,
    ...overrides,
  };
}

describe("RecentActivity", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-03T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the panel header and a 'View all' link to /inbox", () => {
    render(<RecentActivity emails={[makeEmail()]} />);
    expect(screen.getByText("Recent Activity")).toBeInTheDocument();
    expect(
      screen.getByText("Latest emails classified by AI"),
    ).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /view all/i });
    expect(link).toHaveAttribute("href", "/inbox");
  });

  it("renders sender, subject and classification badges for a row", () => {
    render(<RecentActivity emails={[makeEmail()]} />);
    // Sender name appears (table + stacked layouts render both, so use getAll).
    expect(screen.getAllByText("Alice Smith").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Need help with billing").length,
    ).toBeGreaterThan(0);
    // Category + priority badges from dashboard/badges.
    expect(screen.getAllByText("Billing").length).toBeGreaterThan(0);
    expect(screen.getAllByText("High").length).toBeGreaterThan(0);
  });

  it("falls back to '(no subject)' when subject is empty", () => {
    render(<RecentActivity emails={[makeEmail({ subject: null })]} />);
    expect(screen.getAllByText("(no subject)").length).toBeGreaterThan(0);
  });

  it("shows an em dash placeholder when a row has no classification", () => {
    render(<RecentActivity emails={[makeEmail({ classification: null })]} />);
    // Two placeholders in the table layout (category + priority).
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.queryByText("Billing")).toBeNull();
  });

  it("renders an empty state when there are no emails", () => {
    render(<RecentActivity emails={[]} />);
    expect(screen.getByText("No classified emails yet")).toBeInTheDocument();
  });
});
