import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

// Imports a real shared component via the "@/*" alias to prove alias
// resolution + JSX/TSX compilation + component rendering all work together.
import { PriorityBadge } from "@/components/shared";

describe("smoke: shared badge renders", () => {
  it("renders PriorityBadge with its mapped label via @/* alias", () => {
    render(<PriorityBadge priority="URGENT" />);
    expect(screen.getByText("Urgent")).toBeInTheDocument();
  });

  it("maps each priority to the correct label", () => {
    const { rerender } = render(<PriorityBadge priority="HIGH" />);
    expect(screen.getByText("High")).toBeInTheDocument();

    rerender(<PriorityBadge priority="LOW" />);
    expect(screen.getByText("Low")).toBeInTheDocument();
  });
});
