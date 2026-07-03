import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { StatCards } from "@/components/dashboard/stat-cards";
import type { DashboardStats } from "@/lib/types";

function makeStats(overrides: Partial<DashboardStats> = {}): DashboardStats {
  return {
    totalEmails: 1234,
    unread: 12,
    urgent: 8,
    openTasks: 20,
    avgConfidence: 0.9,
    ...overrides,
  };
}

describe("StatCards", () => {
  it("renders the four headline labels", () => {
    render(<StatCards stats={makeStats()} />);
    expect(screen.getByText("Total Emails Today")).toBeInTheDocument();
    expect(screen.getByText("High Priority")).toBeInTheDocument();
    expect(screen.getByText("Waiting for Reply")).toBeInTheDocument();
    expect(screen.getByText("Automatically Resolved")).toBeInTheDocument();
  });

  it("renders each metric value (locale-formatted)", () => {
    render(
      <StatCards
        stats={makeStats({
          totalEmails: 1234,
          urgent: 8,
          unread: 12,
          openTasks: 20,
        })}
      />,
    );
    expect(screen.getByText("1,234")).toBeInTheDocument(); // toLocaleString
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
  });

  it("omits the delta line when no deltas are supplied", () => {
    render(<StatCards stats={makeStats()} />);
    // Hints are always present; delta text is not.
    expect(screen.getAllByText("vs yesterday").length).toBeGreaterThan(0);
    expect(screen.queryByText(/^\+/)).toBeNull();
    expect(screen.queryByText(/%$/)).toBeNull();
  });

  it("renders a percentage delta for percentage metrics (Total Emails)", () => {
    render(
      <StatCards
        stats={makeStats({ deltas: { totalEmails: 15 } })}
      />,
    );
    expect(screen.getByText("+15%")).toBeInTheDocument();
  });

  it("renders a raw-count delta for count metrics (High Priority)", () => {
    render(<StatCards stats={makeStats({ deltas: { urgent: 8 } })} />);
    // deltaAsCount => no percent sign, count style.
    expect(screen.getByText("+8")).toBeInTheDocument();
    expect(screen.queryByText("+8%")).toBeNull();
  });

  it("formats negative deltas with a minus sign", () => {
    render(<StatCards stats={makeStats({ deltas: { totalEmails: -5 } })} />);
    expect(screen.getByText("-5%")).toBeInTheDocument();
  });

  it("renders the hint text for each card", () => {
    render(<StatCards stats={makeStats()} />);
    expect(screen.getByText("needs attention")).toBeInTheDocument();
    // three cards use "vs yesterday"
    expect(screen.getAllByText("vs yesterday")).toHaveLength(3);
  });

  it("forces the 'bad' (red) tone for the High Priority increase", () => {
    render(<StatCards stats={makeStats({ deltas: { urgent: 8 } })} />);
    const deltaSpan = screen.getByText("+8").closest("span");
    expect(deltaSpan?.className).toContain("text-[var(--danger)]");
  });

  it("shows a good (green) tone when a positive-is-good metric rises", () => {
    render(<StatCards stats={makeStats({ deltas: { totalEmails: 15 } })} />);
    const deltaSpan = screen.getByText("+15%").closest("span");
    expect(deltaSpan?.className).toContain("text-[var(--success)]");
  });
});
