"use client";

import * as React from "react";
import { Check, Loader2, Plus, WandSparkles } from "lucide-react";
import { toast } from "sonner";

import {
  automationRuleCreateSchema,
  RULE_FIELD_VALUES,
  RULE_OPERATOR_VALUES,
  RULE_ACTION_TYPE_VALUES,
  type RuleField,
  type RuleOperator,
  type RuleActionType,
} from "@/lib/schemas";
import type { AutomationRuleView } from "@/lib/types";
import { createRule, updateRule } from "@/actions/rules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Friendly labels used both in the <Select> items map and the option list.
const FIELD_LABELS: Record<RuleField, string> = {
  SUBJECT: "Subject",
  FROM: "From address",
  BODY: "Body",
};

const OPERATOR_LABELS: Record<RuleOperator, string> = {
  CONTAINS: "contains",
  EQUALS: "equals",
  STARTS_WITH: "starts with",
};

const ACTION_LABELS: Record<RuleActionType, string> = {
  ASSIGN: "Assign to person",
  SET_PRIORITY: "Set priority",
  SET_CATEGORY: "Set category",
  SET_TEAM: "Route to team",
};

// Helpful placeholder for the action value depending on the action type.
const ACTION_VALUE_HINT: Record<RuleActionType, string> = {
  ASSIGN: "e.g. Finance",
  SET_PRIORITY: "e.g. HIGH",
  SET_CATEGORY: "e.g. BILLING",
  SET_TEAM: "e.g. Support",
};

interface FormState {
  name: string;
  conditionField: RuleField;
  operator: RuleOperator;
  value: string;
  actionType: RuleActionType;
  actionValue: string;
}

function initialState(rule?: AutomationRuleView): FormState {
  return {
    name: rule?.name ?? "",
    conditionField: rule?.conditionField ?? "SUBJECT",
    operator: rule?.operator ?? "CONTAINS",
    value: rule?.value ?? "",
    actionType: rule?.actionType ?? "ASSIGN",
    actionValue: rule?.actionValue ?? "",
  };
}

type FormErrors = Partial<Record<keyof FormState, string>>;

/**
 * Shared form logic for creating/editing rules. Manages state, validation and
 * submission; callers supply the surrounding chrome (dialog or side panel).
 */
function useRuleForm(
  orgId: string,
  rule: AutomationRuleView | undefined,
  onSuccess: () => void
) {
  const [form, setForm] = React.useState<FormState>(() => initialState(rule));
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [isPending, startTransition] = React.useTransition();

  const isEditing = !!rule;

  const reset = React.useCallback(() => {
    setForm(initialState(rule));
    setErrors({});
  }, [rule]);

  const update = React.useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    },
    []
  );

  const submit = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      const parsed = automationRuleCreateSchema.safeParse({
        ...form,
        enabled: rule?.enabled ?? true,
      });

      if (!parsed.success) {
        const fieldErrors: FormErrors = {};
        for (const issue of parsed.error.issues) {
          const key = issue.path[0] as keyof FormState | undefined;
          if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
        }
        setErrors(fieldErrors);
        return;
      }

      startTransition(async () => {
        const result = isEditing
          ? await updateRule({ id: rule.id, ...parsed.data })
          : await createRule({ ...parsed.data, orgId });

        if (!result.ok) {
          toast.error(result.error || "Something went wrong");
          return;
        }

        toast.success(isEditing ? "Rule updated" : "Rule created");
        onSuccess();
      });
    },
    [form, isEditing, onSuccess, orgId, rule]
  );

  return { form, errors, isPending, isEditing, update, submit, reset };
}

/** Small rounded label pill (WHEN / IF / THEN) shown above each block. */
function StagePill({
  label,
  tone,
}: {
  label: string;
  tone: "neutral" | "accent" | "success";
}) {
  const toneClass =
    tone === "accent"
      ? "bg-accent-subtle text-primary"
      : tone === "success"
        ? "bg-[#ECFDF3] text-[#16A34A]"
        : "bg-[#F2F4F7] text-muted-foreground";
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11px] font-bold tracking-[0.5px] ${toneClass}`}
    >
      {label}
    </span>
  );
}

/** Vertical connector line drawn between stage blocks. */
function Connector() {
  return (
    <div className="flex h-6 items-start py-1.5 pl-2.5">
      <div className="h-3 w-0.5 bg-border-strong" />
    </div>
  );
}

/**
 * The core builder form fields, styled to match the "Rule Builder" card in the
 * design: a WHEN/IF/THEN stack with framed selects and inputs.
 */
function RuleFormFields({
  form,
  errors,
  update,
}: {
  form: FormState;
  errors: FormErrors;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <div className="grid gap-3">
      {/* Name */}
      <div className="grid gap-1.5">
        <Label htmlFor="rule-name" className="text-xs">
          Rule name
        </Label>
        <Input
          id="rule-name"
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          placeholder="e.g. Invoice Detection"
          aria-invalid={!!errors.name}
        />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name}</p>
        )}
      </div>

      {/* IF block */}
      <div className="grid gap-2">
        <StagePill label="IF" tone="accent" />
        <div className="grid gap-2 rounded-lg border border-border-strong p-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor="rule-field" className="text-[11px] text-text-tertiary">
                Field
              </Label>
              <Select
                items={FIELD_LABELS}
                value={form.conditionField}
                onValueChange={(v) => update("conditionField", v as RuleField)}
              >
                <SelectTrigger id="rule-field" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RULE_FIELD_VALUES.map((f) => (
                    <SelectItem key={f} value={f}>
                      {FIELD_LABELS[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label
                htmlFor="rule-operator"
                className="text-[11px] text-text-tertiary"
              >
                Operator
              </Label>
              <Select
                items={OPERATOR_LABELS}
                value={form.operator}
                onValueChange={(v) => update("operator", v as RuleOperator)}
              >
                <SelectTrigger id="rule-operator" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RULE_OPERATOR_VALUES.map((op) => (
                    <SelectItem key={op} value={op}>
                      {OPERATOR_LABELS[op]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="rule-value" className="text-[11px] text-text-tertiary">
              Value
            </Label>
            <Input
              id="rule-value"
              value={form.value}
              onChange={(e) => update("value", e.target.value)}
              placeholder="e.g. invoice"
              aria-invalid={!!errors.value}
            />
            {errors.value && (
              <p className="text-xs text-destructive">{errors.value}</p>
            )}
          </div>
        </div>
      </div>

      <Connector />

      {/* THEN block */}
      <div className="grid gap-2">
        <StagePill label="THEN" tone="success" />
        <div className="grid gap-2 rounded-lg border border-border-strong p-3">
          <div className="grid gap-1.5">
            <Label htmlFor="rule-action" className="text-[11px] text-text-tertiary">
              Action
            </Label>
            <Select
              items={ACTION_LABELS}
              value={form.actionType}
              onValueChange={(v) => update("actionType", v as RuleActionType)}
            >
              <SelectTrigger id="rule-action" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RULE_ACTION_TYPE_VALUES.map((a) => (
                  <SelectItem key={a} value={a}>
                    {ACTION_LABELS[a]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label
              htmlFor="rule-action-value"
              className="text-[11px] text-text-tertiary"
            >
              Value
            </Label>
            <Input
              id="rule-action-value"
              value={form.actionValue}
              onChange={(e) => update("actionValue", e.target.value)}
              placeholder={ACTION_VALUE_HINT[form.actionType]}
              aria-invalid={!!errors.actionValue}
            />
            {errors.actionValue && (
              <p className="text-xs text-destructive">{errors.actionValue}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Persistent inline "Rule Builder" side panel shown on the Automation page. It
 * reuses the shared form logic and creates a new rule on save.
 */
export function RuleBuilderPanel({ orgId }: { orgId: string }) {
  // A key that changes on cancel/success to reset the uncontrolled form.
  const [resetKey, setResetKey] = React.useState(0);

  return (
    <aside className="flex w-full shrink-0 flex-col gap-[18px] border-border bg-bg-subtle p-6 lg:w-[400px] lg:border-l lg:p-7">
      <div className="flex items-center gap-2.5">
        <div className="flex size-[34px] shrink-0 items-center justify-center rounded-lg bg-accent-subtle">
          <WandSparkles className="size-[18px] text-primary" />
        </div>
        <div className="flex flex-col">
          <h2 className="text-base font-semibold text-foreground">
            Rule Builder
          </h2>
          <p className="text-xs text-muted-foreground">
            Create a new automation
          </p>
        </div>
      </div>

      <RuleBuilderForm
        key={resetKey}
        orgId={orgId}
        onDone={() => setResetKey((k) => k + 1)}
      />
    </aside>
  );
}

function RuleBuilderForm({
  orgId,
  onDone,
}: {
  orgId: string;
  onDone: () => void;
}) {
  const { form, errors, isPending, update, submit } = useRuleForm(
    orgId,
    undefined,
    onDone
  );

  return (
    <form onSubmit={submit} className="flex flex-col gap-[18px]">
      <div className="rounded-xl border border-border bg-card p-5">
        <RuleFormFields form={form} errors={errors} update={update} />
      </div>

      <div className="flex flex-col gap-2.5">
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Check className="size-4" />
          )}
          Save Rule
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={isPending}
          onClick={onDone}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

interface RuleDialogProps {
  orgId: string;
  /** When provided, the dialog edits this rule; otherwise it creates a new one. */
  rule?: AutomationRuleView;
  /** Controlled open state (used for the edit dialog opened from the table). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Render a default trigger button (used for the "New Rule" create flow). */
  showTrigger?: boolean;
}

/**
 * Modal create/edit form. Used for editing rules from the list (and as a
 * fallback "New Rule" create flow). Shares its form logic with the inline
 * Rule Builder panel.
 */
export function RuleDialog({
  orgId,
  rule,
  open: controlledOpen,
  onOpenChange,
  showTrigger,
}: RuleDialogProps) {
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = isControlled ? controlledOpen : internalOpen;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (isControlled) onOpenChange?.(next);
      else setInternalOpen(next);
    },
    [isControlled, onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {showTrigger && (
        <DialogTrigger
          render={
            <Button>
              <Plus className="size-4" />
              New Rule
            </Button>
          }
        />
      )}
      {open && (
        <DialogFormContent
          orgId={orgId}
          rule={rule}
          onClose={() => setOpen(false)}
        />
      )}
    </Dialog>
  );
}

/**
 * The dialog body is split out so the form state is remounted (and reset) each
 * time the dialog opens, matching the previous open-reset behaviour.
 */
function DialogFormContent({
  orgId,
  rule,
  onClose,
}: {
  orgId: string;
  rule?: AutomationRuleView;
  onClose: () => void;
}) {
  const { form, errors, isPending, isEditing, update, submit } = useRuleForm(
    orgId,
    rule,
    onClose
  );

  return (
    <DialogContent className="sm:max-w-md">
      <form onSubmit={submit} className="grid gap-4">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit rule" : "New rule"}</DialogTitle>
          <DialogDescription>
            Automatically act on incoming emails that match a condition.
          </DialogDescription>
        </DialogHeader>

        <RuleFormFields form={form} errors={errors} update={update} />

        <DialogFooter>
          <DialogClose
            render={
              <Button type="button" variant="outline" disabled={isPending} />
            }
          >
            Cancel
          </DialogClose>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {isEditing ? "Save changes" : "Create rule"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
