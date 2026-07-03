"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CATEGORY_VALUES,
  PRIORITY_VALUES,
  EMAIL_STATUS_VALUES,
} from "@/lib/schemas";
import {
  CATEGORY_LABEL as CATEGORY_LABELS,
  PRIORITY_LABEL as PRIORITY_LABELS,
  STATUS_LABEL as STATUS_LABELS,
} from "@/lib/labels";

const ALL = "ALL";

function titleCase(v: string): string {
  return v.charAt(0) + v.slice(1).toLowerCase();
}

/**
 * Inbox filter bar. Debounced search + Priority/Category/Status selects that
 * write to the URL querystring. The server component re-renders from those
 * params, so this stays a thin URL-sync layer with no local result state.
 */
export function InboxFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const priority = searchParams.get("priority") ?? ALL;
  const category = searchParams.get("category") ?? ALL;
  const status = searchParams.get("status") ?? ALL;

  const urlQuery = searchParams.get("q") ?? "";
  const [search, setSearch] = React.useState(urlQuery);

  // Keep the local input in sync when the URL `q` changes externally (e.g.
  // Clear button, back/forward). Adjusting state during render (React's
  // recommended pattern) avoids a setState-in-effect cascade.
  const [lastUrlQuery, setLastUrlQuery] = React.useState(urlQuery);
  if (urlQuery !== lastUrlQuery) {
    setLastUrlQuery(urlQuery);
    setSearch(urlQuery);
  }

  const pushParams = React.useCallback(
    (updates: Record<string, string | null | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (!value || value === ALL) params.delete(key);
        else params.set(key, value);
      }
      // Any filter change resets pagination.
      params.delete("page");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  // Debounce the search field.
  React.useEffect(() => {
    if (search === urlQuery) return;
    const t = setTimeout(() => {
      pushParams({ q: search.trim() || undefined });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const hasFilters =
    (searchParams.get("q") ?? "") !== "" ||
    priority !== ALL ||
    category !== ALL ||
    status !== ALL;

  function clearAll() {
    setSearch("");
    router.replace(pathname, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="relative flex-1 lg:max-w-sm">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search emails…"
          aria-label="Search emails"
          className="pl-9"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={priority}
          onValueChange={(v) => pushParams({ priority: v })}
        >
          <SelectTrigger className="w-[140px]" aria-label="Filter by priority">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All priorities</SelectItem>
            {PRIORITY_VALUES.map((p) => (
              <SelectItem key={p} value={p}>
                {PRIORITY_LABELS[p] ?? titleCase(p)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={category}
          onValueChange={(v) => pushParams({ category: v })}
        >
          <SelectTrigger className="w-[150px]" aria-label="Filter by category">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {CATEGORY_VALUES.map((c) => (
              <SelectItem key={c} value={c}>
                {CATEGORY_LABELS[c] ?? titleCase(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={status}
          onValueChange={(v) => pushParams({ status: v })}
        >
          <SelectTrigger className="w-[140px]" aria-label="Filter by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {EMAIL_STATUS_VALUES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s] ?? titleCase(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="text-muted-foreground"
          >
            <X className="size-4" aria-hidden />
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  );
}
