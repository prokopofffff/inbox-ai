import {
  Bell,
  Brain,
  ChevronDown,
  Clock3,
  CreditCard,
  Eye,
  Globe,
  KeyRound,
  Mail,
  MailPlus,
  Plug,
  Plus,
  Users,
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  SectionHeader,
  StaticSelect,
  ToggleRow,
} from "@/components/settings/settings-ui";

export const dynamic = "force-dynamic";

const SEED_ORG_ID = "seed-org-inbox-ai";

interface MailboxInfo {
  email: string;
  provider: string;
  connected: boolean;
}

interface SettingsData {
  orgName: string;
  userEmail: string | null;
  mailboxes: MailboxInfo[];
}

async function loadSettings(): Promise<SettingsData> {
  const user = await getCurrentUser();
  const orgId =
    user?.orgId && user.orgId !== "mock-org" ? user.orgId : SEED_ORG_ID;

  const fallback: SettingsData = {
    orgName: "Inbox AI Demo Co.",
    userEmail: user?.email ?? null,
    mailboxes: [
      { email: "alex@acme.co", provider: "gmail", connected: true },
    ],
  };

  try {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        name: true,
        mailboxes: {
          select: { email: true, provider: true, accessToken: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!org || org.mailboxes.length === 0) return fallback;

    return {
      orgName: org.name,
      userEmail: user?.email ?? null,
      mailboxes: org.mailboxes.map((m) => ({
        email: m.email,
        provider: m.provider,
        connected: !!m.accessToken,
      })),
    };
  } catch {
    return fallback;
  }
}

const SUB_NAV = [
  { label: "Integrations", icon: Plug, active: true },
  { label: "AI & Models", icon: Brain, active: false },
  { label: "Notifications", icon: Bell, active: false },
  { label: "Business Hours", icon: Clock3, active: false },
  { label: "Team", icon: Users, active: false },
  { label: "Billing", icon: CreditCard, active: false },
] as const;

const NOTIFICATIONS = [
  {
    title: "High-priority alerts",
    description: "Push a notification the moment an urgent email arrives",
    on: true,
  },
  {
    title: "Daily digest",
    description: "A summary of triaged emails every morning at 8:00 AM",
    on: true,
  },
  {
    title: "Slack notifications",
    description: "Post urgent cases to your #support channel",
    on: false,
  },
  {
    title: "Weekly performance report",
    description: "AI accuracy and volume summary every Monday",
    on: true,
  },
] as const;

const WORKING_DAYS = [
  { label: "Mon", on: true },
  { label: "Tue", on: true },
  { label: "Wed", on: true },
  { label: "Thu", on: true },
  { label: "Fri", on: true },
  { label: "Sat", on: false },
  { label: "Sun", on: false },
] as const;

export default async function SettingsPage() {
  const { mailboxes } = await loadSettings();
  const gmail = mailboxes.find((m) => m.provider === "gmail") ?? {
    email: "alex@acme.co",
    connected: true,
  };

  return (
    <div className="-mx-4 -my-6 flex flex-col sm:-mx-6 lg:-mx-8">
      {/* Page header */}
      <header className="flex flex-col gap-1 border-b border-border px-6 py-6 sm:px-8">
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="text-sm text-text-secondary">
          Manage integrations, AI and workspace preferences
        </p>
      </header>

      <div className="flex flex-col lg:flex-row lg:items-start">
        {/* Sub-nav */}
        <nav className="flex shrink-0 flex-col gap-0.5 border-b border-border p-3 lg:w-56 lg:border-b-0 lg:border-r lg:p-5">
          <div className="flex flex-row gap-0.5 overflow-x-auto lg:flex-col">
            {SUB_NAV.map(({ label, icon: Icon, active }) => (
              <a
                key={label}
                href="#"
                aria-current={active ? "page" : undefined}
                className={[
                  "flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-bg-hover font-semibold text-foreground"
                    : "font-medium text-text-secondary hover:bg-bg-subtle",
                ].join(" ")}
              >
                <Icon className="size-[17px] shrink-0" />
                {label}
              </a>
            ))}
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 px-6 py-8 sm:px-8 lg:px-10">
          <div className="mx-auto flex w-full max-w-[720px] flex-col gap-8">
            {/* Email Integrations */}
            <section className="flex flex-col gap-3.5">
              <SectionHeader
                title="Email Integrations"
                description="Connect your inboxes so Inbox AI can triage incoming mail"
              />
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                {/* Gmail */}
                <div className="flex items-center gap-3.5 border-b border-border p-[18px]">
                  <div className="flex size-[42px] shrink-0 items-center justify-center rounded-lg bg-danger-subtle">
                    <Mail className="size-[22px] text-danger" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[15px] font-semibold text-foreground">
                      Gmail
                    </span>
                    <span className="truncate text-[13px] text-text-secondary">
                      {gmail.email} · Last synced 2 minutes ago
                    </span>
                  </div>
                  <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-success-subtle px-2.5 py-[5px]">
                    <span className="size-[7px] rounded-full bg-success" />
                    <span className="text-xs font-semibold text-success">
                      Connected
                    </span>
                  </span>
                  <button
                    type="button"
                    className="shrink-0 rounded-lg border border-border px-3.5 py-2 text-[13px] font-medium text-text-secondary transition-colors hover:bg-bg-subtle"
                  >
                    Manage
                  </button>
                </div>
                {/* Outlook */}
                <div className="flex items-center gap-3.5 p-[18px]">
                  <div className="flex size-[42px] shrink-0 items-center justify-center rounded-lg bg-accent-subtle">
                    <MailPlus className="size-[22px] text-[#2563EB]" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[15px] font-semibold text-foreground">
                      Outlook
                    </span>
                    <span className="truncate text-[13px] text-text-secondary">
                      Connect a Microsoft 365 or Outlook account
                    </span>
                  </div>
                  <button
                    type="button"
                    className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#1D4ED8]"
                  >
                    <Plus className="size-[15px]" />
                    Connect
                  </button>
                </div>
              </div>
            </section>

            {/* AI Configuration */}
            <section className="flex flex-col gap-3.5">
              <SectionHeader
                title="AI Configuration"
                description="Bring your own model to power classification and replies"
              />
              <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5">
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-semibold text-foreground">
                    OpenAI API Key
                  </label>
                  <div className="flex items-center gap-2.5">
                    <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-border-strong bg-bg-subtle px-3.5 py-[11px]">
                      <KeyRound className="size-4 shrink-0 text-text-tertiary" />
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                        sk-•••••••••••••••••••••••••7f3a
                      </span>
                      <Eye className="size-4 shrink-0 text-text-tertiary" />
                    </div>
                    <button
                      type="button"
                      className="shrink-0 rounded-lg border border-border-strong bg-white px-4 py-[11px] text-[13px] font-semibold text-foreground transition-colors hover:bg-bg-subtle"
                    >
                      Update
                    </button>
                  </div>
                  <p className="text-xs text-text-tertiary">
                    Your key is encrypted at rest and never shared. Used only for
                    your workspace.
                  </p>
                </div>

                <div className="h-px w-full bg-border" />

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3.5">
                  <div className="flex flex-1 flex-col gap-0.5">
                    <span className="text-[13px] font-semibold text-foreground">
                      Model
                    </span>
                    <span className="text-xs text-text-secondary">
                      Higher-tier models improve triage accuracy
                    </span>
                  </div>
                  <StaticSelect value="GPT-4o" className="w-full sm:w-[180px]" />
                </div>
              </div>
            </section>

            {/* Notifications */}
            <section className="flex flex-col gap-3.5">
              <SectionHeader
                title="Notifications"
                description="Choose how and when Inbox AI keeps you in the loop"
              />
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                {NOTIFICATIONS.map((n, i) => (
                  <ToggleRow
                    key={n.title}
                    title={n.title}
                    description={n.description}
                    on={n.on}
                    className={
                      i < NOTIFICATIONS.length - 1
                        ? "border-b border-border"
                        : undefined
                    }
                  />
                ))}
              </div>
            </section>

            {/* Business Hours */}
            <section className="flex flex-col gap-3.5">
              <SectionHeader
                title="Business Hours"
                description="Limit automated replies and alerts to your working hours"
              />
              <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5">
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-semibold text-foreground">
                    Timezone
                  </label>
                  <StaticSelect
                    value="(GMT-08:00) Pacific Time — Los Angeles"
                    icon={
                      <Globe className="size-4 shrink-0 text-text-secondary" />
                    }
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-[13px] font-semibold text-foreground">
                    Working days
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {WORKING_DAYS.map((d) => (
                      <span
                        key={d.label}
                        className={[
                          "w-[52px] rounded-lg border py-2.5 text-center text-[13px] font-semibold",
                          d.on
                            ? "border-transparent bg-primary text-white"
                            : "border-border bg-bg-subtle text-text-secondary",
                        ].join(" ")}
                      >
                        {d.label}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-4 sm:flex-row sm:gap-4">
                  {[
                    { label: "Start time", value: "9:00 AM" },
                    { label: "End time", value: "6:00 PM" },
                  ].map((t) => (
                    <div key={t.label} className="flex flex-1 flex-col gap-2">
                      <span className="text-[13px] font-semibold text-foreground">
                        {t.label}
                      </span>
                      <div className="flex items-center gap-2.5 rounded-lg border border-border-strong bg-white px-3.5 py-[11px]">
                        <Clock3 className="size-4 shrink-0 text-text-secondary" />
                        <span className="flex-1 text-sm text-foreground">
                          {t.value}
                        </span>
                        <ChevronDown className="size-[15px] shrink-0 text-text-tertiary" />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="h-px w-full bg-border" />

                <div className="flex items-center gap-3.5">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-sm font-semibold text-foreground">
                      Pause automation outside business hours
                    </span>
                    <span className="text-[13px] text-text-secondary">
                      Emails are queued and triaged when you&apos;re back online
                    </span>
                  </div>
                  <span
                    role="switch"
                    aria-checked
                    className="flex h-[22px] w-[38px] shrink-0 items-center justify-end rounded-full bg-primary p-[2px]"
                  >
                    <span className="size-[18px] rounded-full bg-white shadow-sm" />
                  </span>
                </div>
              </div>
            </section>

            {/* Save bar */}
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                className="rounded-lg border border-border bg-white px-[18px] py-[11px] text-sm font-medium text-text-secondary transition-colors hover:bg-bg-subtle"
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-primary px-[18px] py-[11px] text-sm font-semibold text-white transition-colors hover:bg-[#1D4ED8]"
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
