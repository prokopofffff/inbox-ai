import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { avatarColor, formatFullDate, initials, timeAgo } from "@/components/inbox/utils";

const FIXED_NOW = new Date("2026-07-03T12:00:00.000Z");

describe("timeAgo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns empty string for null/undefined", () => {
    expect(timeAgo(null)).toBe("");
    expect(timeAgo(undefined)).toBe("");
  });

  it("returns empty string for an invalid date", () => {
    expect(timeAgo("not-a-date")).toBe("");
    expect(timeAgo(new Date("nope"))).toBe("");
  });

  it("compacts minutes", () => {
    const d = new Date(FIXED_NOW.getTime() - 5 * 60 * 1000);
    expect(timeAgo(d)).toBe("5m");
  });

  it("compacts hours", () => {
    const d = new Date(FIXED_NOW.getTime() - 3 * 60 * 60 * 1000);
    expect(timeAgo(d)).toBe("3h");
  });

  it("compacts days", () => {
    const d = new Date(FIXED_NOW.getTime() - 2 * 24 * 60 * 60 * 1000);
    expect(timeAgo(d)).toBe("2d");
  });

  it("accepts an ISO string input", () => {
    const iso = new Date(FIXED_NOW.getTime() - 10 * 60 * 1000).toISOString();
    expect(timeAgo(iso)).toBe("10m");
  });

  it("does not contain the long unit words after compaction", () => {
    const d = new Date(FIXED_NOW.getTime() - 45 * 60 * 1000);
    const out = timeAgo(d);
    expect(out).not.toMatch(/minute|hour|day/);
  });
});

describe("formatFullDate", () => {
  it("returns empty string for null/undefined/invalid", () => {
    expect(formatFullDate(null)).toBe("");
    expect(formatFullDate(undefined)).toBe("");
    expect(formatFullDate("garbage")).toBe("");
  });

  it("produces a non-empty human string for a valid date", () => {
    const out = formatFullDate(new Date("2026-07-03T12:00:00.000Z"));
    expect(out.length).toBeGreaterThan(0);
    expect(out).toMatch(/2026/);
  });

  it("accepts a string date", () => {
    expect(formatFullDate("2026-07-03T12:00:00.000Z")).toMatch(/2026/);
  });
});

describe("initials", () => {
  it("returns two-letter initials from a full name", () => {
    expect(initials("Sarah Chen")).toBe("SC");
  });

  it("uses first two letters for a single-word name", () => {
    expect(initials("Cher")).toBe("CH");
  });

  it("falls back to the email local-part when name is empty", () => {
    expect(initials(null, "alex.morgan@x.com")).toBe("AM");
    expect(initials("", "sam@x.com")).toBe("SA");
  });

  it("splits on dots, underscores and hyphens", () => {
    expect(initials("jane_doe")).toBe("JD");
    expect(initials("jane-doe")).toBe("JD");
    expect(initials("jane.doe")).toBe("JD");
  });

  it("prefers name over email when both present", () => {
    expect(initials("Grace Liu", "someone@else.com")).toBe("GL");
  });

  it("returns ? when nothing usable is given", () => {
    expect(initials(null)).toBe("?");
    expect(initials("", "")).toBe("?");
    expect(initials("   ")).toBe("?");
  });

  it("uppercases the result", () => {
    expect(initials("marcus reid")).toBe("MR");
  });
});

describe("avatarColor", () => {
  it("is deterministic for the same seed", () => {
    expect(avatarColor("sarah@acme.io")).toBe(avatarColor("sarah@acme.io"));
  });

  it("returns a class string from the palette", () => {
    expect(avatarColor("x")).toMatch(/^bg-\w+-100 text-\w+-700$/);
  });

  it("handles an empty seed without throwing", () => {
    expect(typeof avatarColor("")).toBe("string");
  });

  it("distributes across more than one palette entry", () => {
    const seeds = ["a", "b", "c", "d", "e", "f", "g", "hh", "iii", "jjjj"];
    const colors = new Set(seeds.map(avatarColor));
    expect(colors.size).toBeGreaterThan(1);
  });
});
