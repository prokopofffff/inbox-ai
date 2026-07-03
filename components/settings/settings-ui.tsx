import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Presentational building blocks for the Settings screen. These match the
 * static design export (png/i92Mnr.png) and are intentionally read-only — the
 * page renders in mock mode, so toggles/selects are styled but non-interactive.
 */

export function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-[3px]">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="text-[13px] text-text-secondary">{description}</p>
    </div>
  );
}

/** A static on/off pill toggle mirroring the design (accent when on). */
export function StaticToggle({ on }: { on: boolean }) {
  return (
    <span
      role="switch"
      aria-checked={on}
      className={cn(
        "flex h-[22px] w-[38px] shrink-0 items-center rounded-full p-[2px] transition-colors",
        on ? "justify-end bg-primary" : "justify-start bg-border-strong",
      )}
    >
      <span className="size-[18px] rounded-full bg-white shadow-sm" />
    </span>
  );
}

/** A settings row: label + description on the left, control on the right. */
export function ToggleRow({
  title,
  description,
  on,
  className,
}: {
  title: string;
  description: string;
  on: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-[14px] px-[18px] py-4",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <span className="text-[13px] text-text-secondary">{description}</span>
      </div>
      <StaticToggle on={on} />
    </div>
  );
}

/** A static select-looking control (chevron), used for read-only fields. */
export function StaticSelect({
  value,
  icon,
  className,
}: {
  value: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-fit items-center gap-2 rounded-lg border border-border-strong bg-white px-3 py-2.5",
        className,
      )}
    >
      {icon}
      <span className="flex-1 truncate text-[13px] font-medium text-foreground">
        {value}
      </span>
      <ChevronDown className="size-[15px] shrink-0 text-text-tertiary" />
    </div>
  );
}
