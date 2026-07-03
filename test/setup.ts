import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

/**
 * Global test setup.
 *
 * 1. Extends Vitest's `expect` with jest-dom matchers.
 * 2. Polyfills browser APIs that jsdom does not implement but that our
 *    dependencies (Recharts, next-themes, cmdk, etc.) touch on render.
 * 3. Forces MOCK MODE by unsetting every credential env var so the `hasX`
 *    feature flags in lib/env.ts evaluate to false and callers fall back to
 *    mock data instead of hitting a DB / external API.
 */

// --- Unmount React trees between tests to avoid cross-test leakage. ---------
afterEach(() => {
  cleanup();
});

// --- MOCK MODE: strip all real credentials so hasX flags are false. ---------
for (const key of [
  "DATABASE_URL",
  "DIRECT_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "CRON_SECRET",
]) {
  delete process.env[key];
}

// --- matchMedia (next-themes reads prefers-color-scheme). -------------------
if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// --- ResizeObserver (Recharts ResponsiveContainer, some shadcn primitives). -
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver =
    ResizeObserverStub as unknown as typeof ResizeObserver;
}

// --- IntersectionObserver (lazy/visibility-driven UI). ----------------------
class IntersectionObserverStub {
  readonly root: Element | null = null;
  readonly rootMargin: string = "";
  readonly thresholds: ReadonlyArray<number> = [];
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}
if (!("IntersectionObserver" in globalThis)) {
  globalThis.IntersectionObserver =
    IntersectionObserverStub as unknown as typeof IntersectionObserver;
}
