import type { Category, Priority, Sentiment } from "@/lib/types";

/**
 * Chart color palettes.
 *
 * Plain hex values (not CSS vars) so Recharts SVG fills render identically on
 * server-generated markup and after hydration, and so tooltips/legends stay
 * legible in both themes. Mirrors the design tokens.
 */

// Design tokens: Priority High=danger(red), Medium=warning(amber), Low=success(green).
export const PRIORITY_COLORS: Record<Priority, string> = {
  URGENT: "#dc2626", // danger (red)
  HIGH: "#dc2626", // danger (red)
  MEDIUM: "#d97706", // warning (amber)
  LOW: "#16a34a", // success (green)
};

// Sentiment: Positive=success(green), Neutral=slate/secondary, Negative=danger(red).
export const SENTIMENT_COLORS: Record<Sentiment, string> = {
  POSITIVE: "#16a34a", // success (green)
  NEUTRAL: "#667085", // text-secondary (slate)
  NEGATIVE: "#dc2626", // danger (red)
};

// Category bars/donut — accent blue · purple · amber · green · slate family.
export const CATEGORY_COLORS: Record<Category, string> = {
  SUPPORT: "#2563eb", // accent (blue)
  SALES: "#7c3aed", // purple
  BILLING: "#d97706", // warning (amber)
  GENERAL: "#16a34a", // success (green) — shown as "Product" in the design
  SPAM: "#98a2b3", // text-tertiary (slate)
  INTERNAL: "#667085", // text-secondary (slate)
};

/** Accent used for the volume area/line chart. */
export const ACCENT = "#2563eb";
