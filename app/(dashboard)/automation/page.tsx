import { Zap } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import type { AutomationRuleView } from "@/lib/types";
import { RulesTable } from "@/components/automation/rules-table";
import { RuleDialog, RuleBuilderPanel } from "@/components/automation/rule-dialog";

// Rules are user data — always render fresh.
export const dynamic = "force-dynamic";

/** Fallback org id matching the Prisma seed, used in mock/dev mode. */
const SEED_ORG_ID = "seed-org-inbox-ai";

/**
 * Example rules shown when no database is available (mock mode) so the page
 * renders meaningfully. These mirror the seeded rules.
 */
const EXAMPLE_RULES: AutomationRuleView[] = [
  {
    id: "example-invoice",
    name: "Invoice Detection",
    conditionField: "SUBJECT",
    operator: "CONTAINS",
    value: "invoice",
    actionType: "ASSIGN",
    actionValue: "Finance",
    enabled: true,
    createdAt: new Date(),
  },
  {
    id: "example-refund",
    name: "Refund Requests",
    conditionField: "BODY",
    operator: "CONTAINS",
    value: "refund",
    actionType: "SET_TEAM",
    actionValue: "Support",
    enabled: true,
    createdAt: new Date(),
  },
  {
    id: "example-enterprise",
    name: "Enterprise Customers",
    conditionField: "FROM",
    operator: "CONTAINS",
    value: "enterprise",
    actionType: "SET_CATEGORY",
    actionValue: "Sales",
    enabled: true,
    createdAt: new Date(),
  },
  {
    id: "example-negative",
    name: "Negative Sentiment",
    conditionField: "BODY",
    operator: "CONTAINS",
    value: "frustrated",
    actionType: "SET_PRIORITY",
    actionValue: "High",
    enabled: true,
    createdAt: new Date(),
  },
  {
    id: "example-feature",
    name: "Feature Requests",
    conditionField: "BODY",
    operator: "CONTAINS",
    value: "suggestion",
    actionType: "SET_CATEGORY",
    actionValue: "Product backlog",
    enabled: true,
    createdAt: new Date(),
  },
  {
    id: "example-spam",
    name: "Spam Filter",
    conditionField: "SUBJECT",
    operator: "CONTAINS",
    value: "promo",
    actionType: "SET_TEAM",
    actionValue: "Auto-archive",
    enabled: false,
    createdAt: new Date(),
  },
];

async function resolveOrgId(): Promise<string> {
  const user = await getCurrentUser();
  // The mock user has orgId "mock-org", which won't exist in a real DB — fall
  // back to the seeded org so created rules attach to real data when present.
  if (user?.orgId && user.orgId !== "mock-org") return user.orgId;
  return SEED_ORG_ID;
}

/**
 * Loads rules for the org. Degrades to example rules if the database is
 * unavailable (e.g. no DATABASE_URL configured) so the page always renders.
 */
async function loadRules(
  orgId: string
): Promise<{ rules: AutomationRuleView[]; isExample: boolean }> {
  try {
    const rows = await prisma.automationRule.findMany({
      where: { orgId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        conditionField: true,
        operator: true,
        value: true,
        actionType: true,
        actionValue: true,
        enabled: true,
        createdAt: true,
      },
    });
    return { rules: rows, isExample: false };
  } catch {
    return { rules: EXAMPLE_RULES, isExample: true };
  }
}

export default async function AutomationPage() {
  const orgId = await resolveOrgId();
  const { rules, isExample } = await loadRules(orgId);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <header className="flex flex-col gap-4 border-b border-border px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-[22px] font-semibold tracking-[-0.5px] text-foreground">
            Automation Rules
          </h1>
          <p className="text-sm text-muted-foreground">
            Route, prioritize and assign emails automatically with AI
          </p>
        </div>
        <RuleDialog orgId={orgId} showTrigger />
      </header>

      {/* Body: rules list + builder panel */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6 sm:p-8">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-semibold text-foreground">
              Active Rules
            </h2>
            <span className="rounded-full bg-bg-hover px-2 py-0.5 text-xs font-semibold text-muted-foreground">
              {rules.length}
            </span>
          </div>

          {isExample && (
            <div className="rounded-lg border border-dashed border-border bg-bg-subtle px-4 py-3 text-sm text-muted-foreground">
              Showing example rules — connect a database to create and manage
              your own automation rules.
            </div>
          )}

          {rules.length === 0 ? (
            <EmptyState orgId={orgId} />
          ) : (
            <RulesTable rules={rules} orgId={orgId} />
          )}
        </div>

        <RuleBuilderPanel orgId={orgId} />
      </div>
    </div>
  );
}

function EmptyState({ orgId }: { orgId: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-bg-subtle">
        <Zap className="size-6 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <h2 className="text-base font-medium text-foreground">
          No automation rules yet
        </h2>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          Rules run on every incoming email. Use the Rule Builder to create your
          first one — for example, when the subject contains{" "}
          <span className="rounded bg-bg-hover px-1 py-0.5 font-mono text-xs">
            invoice
          </span>
          , assign it to Finance.
        </p>
      </div>
      <RuleDialog orgId={orgId} showTrigger />
    </div>
  );
}
