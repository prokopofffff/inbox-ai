import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Consistent page heading block for dashboard routes.
 *
 * Matches the design's page header: title + optional subtitle on the left,
 * right-aligned actions slot (buttons, filters, search), a subtle bottom
 * border, and generous padding. Responsive: actions wrap below the title on
 * small screens.
 */
export function PageHeader({
  title,
  description,
  badge,
  actions,
  className,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Optional inline pill next to the title (e.g. "128 unread"). */
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 border-b border-border bg-card px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-8",
        className
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-semibold tracking-[-0.4px] text-foreground sm:text-2xl sm:tracking-[-0.5px]">
            {title}
          </h1>
          {badge}
        </div>
        {description ? (
          <p className="text-sm text-text-secondary">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2.5">
          {actions}
        </div>
      ) : null}
      {children}
    </div>
  );
}
