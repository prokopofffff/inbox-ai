"use client";

import * as React from "react";
import {
  ArrowRight,
  Flag,
  Landmark,
  Loader2,
  Pencil,
  Tag,
  Trash2,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import type { AutomationRuleView } from "@/lib/types";
import type {
  RuleField,
  RuleOperator,
  RuleActionType,
} from "@/lib/schemas";
import { deleteRule, toggleRule } from "@/actions/rules";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RuleDialog } from "@/components/automation/rule-dialog";

// Human-readable labels for the rule condition/action enums.
const FIELD_LABEL: Record<RuleField, string> = {
  SUBJECT: "Subject",
  FROM: "Sender",
  BODY: "Body",
};

const OPERATOR_LABEL: Record<RuleOperator, string> = {
  CONTAINS: "contains",
  EQUALS: "is",
  STARTS_WITH: "starts with",
};

const ACTION_VERB: Record<RuleActionType, string> = {
  ASSIGN: "Assign to",
  SET_PRIORITY: "Set priority to",
  SET_CATEGORY: "Set category to",
  SET_TEAM: "Route to",
};

// Tone for the "THEN" action chip, keyed by action type.
type Tone = { chip: string; text: string; icon: string };

const ACTION_TONE: Record<RuleActionType, Tone> = {
  ASSIGN: {
    chip: "bg-accent-subtle",
    text: "text-primary",
    icon: "text-primary",
  },
  SET_TEAM: {
    chip: "bg-[#ECFDF3]",
    text: "text-[#16A34A]",
    icon: "text-[#16A34A]",
  },
  SET_PRIORITY: {
    chip: "bg-[#FEF3F2]",
    text: "text-[#DC2626]",
    icon: "text-[#DC2626]",
  },
  SET_CATEGORY: {
    chip: "bg-[#F5F3FF]",
    text: "text-[#7C3AED]",
    icon: "text-[#7C3AED]",
  },
};

function ActionIcon({
  actionType,
  className,
}: {
  actionType: RuleActionType;
  className?: string;
}) {
  switch (actionType) {
    case "ASSIGN":
      return <Landmark className={className} />;
    case "SET_TEAM":
      return <Users className={className} />;
    case "SET_PRIORITY":
      return <Flag className={className} />;
    case "SET_CATEGORY":
      return <Tag className={className} />;
  }
}

/** The "IF <field> <operator> value" pill + arrow + colored action chip row. */
function RuleFlow({ rule }: { rule: AutomationRuleView }) {
  const tone = ACTION_TONE[rule.actionType];
  return (
    <div className="flex flex-wrap items-center gap-2.5 border-t border-border pt-3">
      <span className="flex items-center gap-2 rounded-lg bg-bg-subtle px-3 py-2">
        <span className="text-[11px] font-bold tracking-[0.4px] text-text-tertiary">
          IF
        </span>
        <span className="text-[13px] font-medium text-foreground">
          {FIELD_LABEL[rule.conditionField]} {OPERATOR_LABEL[rule.operator]}{" "}
          &ldquo;{rule.value}&rdquo;
        </span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-text-tertiary" />
      <span
        className={cn(
          "flex items-center gap-2 rounded-lg px-3 py-2",
          tone.chip
        )}
      >
        <ActionIcon
          actionType={rule.actionType}
          className={cn("size-3.5 shrink-0", tone.icon)}
        />
        <span className={cn("text-[13px] font-semibold", tone.text)}>
          {ACTION_VERB[rule.actionType]} {rule.actionValue}
        </span>
      </span>
    </div>
  );
}

interface RulesTableProps {
  rules: AutomationRuleView[];
  orgId: string;
}

export function RulesTable({ rules, orgId }: RulesTableProps) {
  // Optimistic enabled state keyed by rule id.
  const [optimistic, setOptimistic] = React.useState<Record<string, boolean>>(
    {}
  );
  const [pendingToggle, setPendingToggle] = React.useState<Set<string>>(
    new Set()
  );

  const [editing, setEditing] = React.useState<AutomationRuleView | null>(null);
  const [deleting, setDeleting] = React.useState<AutomationRuleView | null>(
    null
  );
  const [isDeletePending, startDelete] = React.useTransition();

  const isEnabled = React.useCallback(
    (rule: AutomationRuleView) => optimistic[rule.id] ?? rule.enabled,
    [optimistic]
  );

  async function handleToggle(rule: AutomationRuleView, next: boolean) {
    setOptimistic((prev) => ({ ...prev, [rule.id]: next }));
    setPendingToggle((prev) => new Set(prev).add(rule.id));

    const result = await toggleRule(rule.id, next);

    setPendingToggle((prev) => {
      const copy = new Set(prev);
      copy.delete(rule.id);
      return copy;
    });

    if (!result.ok) {
      // Roll back the optimistic value on failure.
      setOptimistic((prev) => ({ ...prev, [rule.id]: rule.enabled }));
      toast.error(result.error || "Failed to update rule");
      return;
    }

    toast.success(next ? "Rule enabled" : "Rule disabled");
  }

  function handleDelete() {
    if (!deleting) return;
    const target = deleting;
    startDelete(async () => {
      const result = await deleteRule(target.id);
      if (!result.ok) {
        toast.error(result.error || "Failed to delete rule");
        return;
      }
      toast.success("Rule deleted");
      setDeleting(null);
    });
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {rules.map((rule) => {
          const enabled = isEnabled(rule);
          const toggling = pendingToggle.has(rule.id);
          return (
            <div
              key={rule.id}
              className={cn(
                "group flex flex-col gap-3.5 rounded-xl border border-border bg-card p-[18px] transition-opacity",
                !enabled && "opacity-60"
              )}
            >
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-bg-subtle">
                  <Zap className="size-4 text-muted-foreground" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="truncate text-[15px] font-semibold text-foreground">
                    {rule.name}
                  </p>
                  <p className="truncate text-xs text-text-tertiary">
                    {enabled ? "Active" : "Paused"} · updated recently
                  </p>
                </div>

                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Edit rule"
                    onClick={() => setEditing(rule)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete rule"
                    onClick={() => setDeleting(rule)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>

                <Switch
                  checked={enabled}
                  disabled={toggling}
                  onCheckedChange={(checked) => handleToggle(rule, checked)}
                  aria-label={enabled ? "Disable rule" : "Enable rule"}
                />
              </div>

              <RuleFlow rule={rule} />
            </div>
          );
        })}
      </div>

      {/* Edit dialog (controlled). */}
      {editing && (
        <RuleDialog
          orgId={orgId}
          rule={editing}
          open={!!editing}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
        />
      )}

      {/* Delete confirmation dialog. */}
      <Dialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open && !isDeletePending) setDeleting(null);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete rule</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete
              {deleting ? ` "${deleting.name}"` : " this rule"}? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              render={<Button variant="outline" disabled={isDeletePending} />}
            >
              Cancel
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeletePending}
            >
              {isDeletePending && <Loader2 className="size-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
