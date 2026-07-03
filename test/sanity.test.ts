import { describe, it, expect } from "vitest";

// Proves the Vitest runner + jsdom env + globals wiring is functional.
describe("sanity", () => {
  it("does arithmetic", () => {
    expect(1 + 1).toBe(2);
  });

  it("runs in a jsdom environment", () => {
    expect(typeof window).toBe("object");
    expect(typeof document).toBe("object");
  });

  it("has jest-dom matchers registered", () => {
    const el = document.createElement("div");
    el.textContent = "hi";
    document.body.appendChild(el);
    expect(el).toBeInTheDocument();
    expect(el).toHaveTextContent("hi");
  });
});
