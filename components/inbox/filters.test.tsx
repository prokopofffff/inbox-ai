import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";

// --- Mock next/navigation -------------------------------------------------
const replace = vi.fn();
const push = vi.fn();
let currentParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
  usePathname: () => "/inbox",
  useSearchParams: () => currentParams,
}));

import { InboxFilters } from "@/components/inbox/filters";

function setParams(qs: string) {
  currentParams = new URLSearchParams(qs);
}

describe("InboxFilters", () => {
  beforeEach(() => {
    replace.mockClear();
    push.mockClear();
    setParams("");
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("does not push before the debounce window elapses", () => {
    render(<InboxFilters />);
    const input = screen.getByLabelText("Search emails");
    fireEvent.change(input, { target: { value: "invoice" } });
    // Not yet — 350ms debounce.
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(replace).not.toHaveBeenCalled();
  });

  it("pushes the search term to the URL after the debounce", () => {
    render(<InboxFilters />);
    const input = screen.getByLabelText("Search emails");
    fireEvent.change(input, { target: { value: "invoice" } });
    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/inbox?q=invoice", { scroll: false });
  });

  it("debounces rapid typing into a single push with the final value", () => {
    render(<InboxFilters />);
    const input = screen.getByLabelText("Search emails");
    fireEvent.change(input, { target: { value: "a" } });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    fireEvent.change(input, { target: { value: "ab" } });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    fireEvent.change(input, { target: { value: "abc" } });
    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/inbox?q=abc", { scroll: false });
  });

  it("trims whitespace and removes q when the search is cleared to blank", () => {
    setParams("q=old");
    render(<InboxFilters />);
    const input = screen.getByLabelText("Search emails");
    fireEvent.change(input, { target: { value: "   " } });
    act(() => {
      vi.advanceTimersByTime(350);
    });
    // Blank trims to undefined -> q deleted -> bare pathname.
    expect(replace).toHaveBeenCalledWith("/inbox", { scroll: false });
  });

  it("preserves other existing params and always resets page", () => {
    setParams("priority=HIGH&page=3");
    render(<InboxFilters />);
    const input = screen.getByLabelText("Search emails");
    fireEvent.change(input, { target: { value: "hello" } });
    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(replace).toHaveBeenCalledTimes(1);
    const [url] = replace.mock.calls[0];
    const parsed = new URLSearchParams(url.split("?")[1]);
    expect(parsed.get("priority")).toBe("HIGH");
    expect(parsed.get("q")).toBe("hello");
    expect(parsed.has("page")).toBe(false);
  });

  it("shows a Clear button when filters are active and resets to the bare path", () => {
    setParams("priority=HIGH&q=abc");
    render(<InboxFilters />);
    const clear = screen.getByRole("button", { name: /clear/i });
    fireEvent.click(clear);
    expect(replace).toHaveBeenCalledWith("/inbox", { scroll: false });
  });

  it("hides the Clear button when no filters are active", () => {
    setParams("");
    render(<InboxFilters />);
    expect(screen.queryByRole("button", { name: /clear/i })).toBeNull();
  });

  it("renders the three filter selects with initial values from the URL", () => {
    setParams("priority=HIGH&category=BILLING&status=UNREAD");
    render(<InboxFilters />);
    expect(screen.getByLabelText("Filter by priority")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by category")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by status")).toBeInTheDocument();
    // The hidden native inputs base-ui renders carry the current URL values,
    // proving the selects are initialised from the querystring.
    const hidden = Array.from(
      document.querySelectorAll<HTMLInputElement>("input[aria-hidden]"),
    ).map((i) => i.value);
    expect(hidden).toContain("HIGH");
    expect(hidden).toContain("BILLING");
    expect(hidden).toContain("UNREAD");
  });
});
