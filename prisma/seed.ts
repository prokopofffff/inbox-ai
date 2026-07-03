import {
  PrismaClient,
  Role,
  EmailStatus,
  Category,
  Priority,
  Sentiment,
  RuleField,
  RuleOperator,
  RuleActionType,
  TaskStatus,
} from "@prisma/client"

// Prisma 7 "client" engine needs a driver adapter. Seeding always runs against
// a real database, so we build the pg adapter here. Requires `@prisma/adapter-pg`
// and `pg` to be installed (see README → "Enabling a real database").
function makePrisma(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is required to seed. Set it in .env before running db:seed.",
    )
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaPg } = require("@prisma/adapter-pg")
    const adapter = new PrismaPg({ connectionString })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new PrismaClient({ adapter } as any)
  } catch {
    throw new Error(
      "Missing Prisma driver adapter. Run `npm i @prisma/adapter-pg pg` before seeding.",
    )
  }
}

const prisma = makePrisma()

// Deterministic helper: hours ago from "now".
const now = Date.now()
const hoursAgo = (h: number) => new Date(now - h * 60 * 60 * 1000)

type SeedEmail = {
  gmailId: string
  threadId: string
  fromAddr: string
  fromName: string
  toAddr: string
  subject: string
  snippet: string
  bodyText: string
  hours: number
  status: EmailStatus
  assigneeKey?: "owner" | "admin" | "member"
  classification: {
    category: Category
    priority: Priority
    summary: string
    suggestedReply: string
    sentiment: Sentiment
    confidence: number
    assignee?: string | null
  }
}

const SEED_EMAILS: SeedEmail[] = [
  {
    gmailId: "seed-msg-0001",
    threadId: "seed-thread-0001",
    fromAddr: "sarah.chen@acmecorp.com",
    fromName: "Sarah Chen",
    toAddr: "support@inboxai.dev",
    subject: "Urgent: Production outage on our dashboard",
    snippet: "Our entire team is locked out and customers are affected...",
    bodyText:
      "Hi team, our production dashboard has been down for the last 20 minutes. Our entire team is locked out and customers are affected. Please escalate ASAP.",
    hours: 0.5,
    status: EmailStatus.UNREAD,
    assigneeKey: "owner",
    classification: {
      category: Category.SUPPORT,
      priority: Priority.URGENT,
      summary: "Customer reporting a production outage affecting their whole team and their customers.",
      suggestedReply:
        "Hi Sarah, we're so sorry for the disruption. Our on-call engineer is investigating right now and I'll update you within 15 minutes. In the meantime, could you confirm your account ID so we can trace the issue faster?",
      sentiment: Sentiment.NEGATIVE,
      confidence: 0.97,
      assignee: "Support",
    },
  },
  {
    gmailId: "seed-msg-0002",
    threadId: "seed-thread-0002",
    fromAddr: "billing@globex.io",
    fromName: "Globex Billing",
    toAddr: "billing@inboxai.dev",
    subject: "Invoice #10432 payment failed",
    snippet: "The card on file was declined for invoice #10432...",
    bodyText:
      "Hello, the card on file was declined for invoice #10432. Please update your payment method to avoid service interruption.",
    hours: 1.5,
    status: EmailStatus.UNREAD,
    assigneeKey: "admin",
    classification: {
      category: Category.BILLING,
      priority: Priority.HIGH,
      summary: "Payment for invoice #10432 failed; card on file was declined.",
      suggestedReply:
        "Hi, thanks for the heads up. We'll update the payment method on file for invoice #10432 today and confirm once it clears. Apologies for the inconvenience.",
      sentiment: Sentiment.NEUTRAL,
      confidence: 0.92,
      assignee: "Finance",
    },
  },
  {
    gmailId: "seed-msg-0003",
    threadId: "seed-thread-0003",
    fromAddr: "jordan.mills@startup.co",
    fromName: "Jordan Mills",
    toAddr: "sales@inboxai.dev",
    subject: "Interested in the Enterprise plan",
    snippet: "We're a 200-person company evaluating email tooling...",
    bodyText:
      "Hi, we're a 200-person company evaluating email tooling and Inbox AI looks great. Could we set up a demo of the Enterprise plan this week?",
    hours: 2,
    status: EmailStatus.READ,
    assigneeKey: "member",
    classification: {
      category: Category.SALES,
      priority: Priority.HIGH,
      summary: "Prospective 200-person customer requesting an Enterprise plan demo this week.",
      suggestedReply:
        "Hi Jordan, thrilled to hear you're evaluating Inbox AI! I'd love to walk your team through the Enterprise plan. Are you free Thursday or Friday afternoon? Here's my calendar link.",
      sentiment: Sentiment.POSITIVE,
      confidence: 0.95,
      assignee: "Sales",
    },
  },
  {
    gmailId: "seed-msg-0004",
    threadId: "seed-thread-0004",
    fromAddr: "no-reply@spammy-deals.biz",
    fromName: "Deals Bot",
    toAddr: "support@inboxai.dev",
    subject: "You WON a $1000 gift card!!!",
    snippet: "Click here now to claim your exclusive reward...",
    bodyText:
      "Congratulations!!! You have been selected to receive a $1000 gift card. Click here now to claim your exclusive reward before it expires!",
    hours: 3,
    status: EmailStatus.UNREAD,
    classification: {
      category: Category.SPAM,
      priority: Priority.LOW,
      summary: "Obvious promotional spam claiming a gift-card prize.",
      suggestedReply:
        "No reply needed — this message has been flagged as spam and can be archived.",
      sentiment: Sentiment.NEUTRAL,
      confidence: 0.99,
      assignee: null,
    },
  },
  {
    gmailId: "seed-msg-0005",
    threadId: "seed-thread-0005",
    fromAddr: "vip@bigclient.com",
    fromName: "Morgan Blake",
    toAddr: "support@inboxai.dev",
    subject: "Customer VIP — need a feature update",
    snippet: "As a VIP customer we'd like an ETA on SSO support...",
    bodyText:
      "Hi, as a VIP customer we'd like an ETA on SSO support. This is a blocker for our rollout. Can someone from the team follow up today?",
    hours: 4,
    status: EmailStatus.UNREAD,
    assigneeKey: "owner",
    classification: {
      category: Category.SUPPORT,
      priority: Priority.HIGH,
      summary: "VIP customer requesting an ETA on SSO support, which is blocking their rollout.",
      suggestedReply:
        "Hi Morgan, thanks for flagging this. SSO is on our near-term roadmap — let me get you a concrete ETA from the product team and follow up by end of day.",
      sentiment: Sentiment.NEUTRAL,
      confidence: 0.9,
      assignee: "Support",
    },
  },
  {
    gmailId: "seed-msg-0006",
    threadId: "seed-thread-0006",
    fromAddr: "alex.rivera@shopnow.com",
    fromName: "Alex Rivera",
    toAddr: "support@inboxai.dev",
    subject: "Request for a refund on my subscription",
    snippet: "I'd like to request a refund for last month's charge...",
    bodyText:
      "Hello, I'd like to request a refund for last month's charge. The product didn't meet our needs and we've since cancelled. Please advise.",
    hours: 5,
    status: EmailStatus.READ,
    assigneeKey: "member",
    classification: {
      category: Category.BILLING,
      priority: Priority.MEDIUM,
      summary: "Customer requesting a refund for last month's charge after cancelling.",
      suggestedReply:
        "Hi Alex, sorry Inbox AI wasn't the right fit. I can process a refund for last month's charge — could you confirm the email on the account so I can locate it?",
      sentiment: Sentiment.NEGATIVE,
      confidence: 0.88,
      assignee: "Support",
    },
  },
  {
    gmailId: "seed-msg-0007",
    threadId: "seed-thread-0007",
    fromAddr: "team@inboxai.dev",
    fromName: "Internal Ops",
    toAddr: "owner@inboxai.dev",
    subject: "Weekly standup notes",
    snippet: "Sharing the notes from this week's engineering standup...",
    bodyText:
      "Sharing the notes from this week's engineering standup. Key items: shipped the classifier v2, cron polling stabilized, dashboard perf improvements queued.",
    hours: 6,
    status: EmailStatus.READ,
    assigneeKey: "admin",
    classification: {
      category: Category.INTERNAL,
      priority: Priority.LOW,
      summary: "Internal engineering standup notes summarizing weekly progress.",
      suggestedReply:
        "Thanks for the recap! Great to see the classifier v2 shipped. Let's sync on the dashboard perf work in tomorrow's planning.",
      sentiment: Sentiment.POSITIVE,
      confidence: 0.85,
      assignee: null,
    },
  },
  {
    gmailId: "seed-msg-0008",
    threadId: "seed-thread-0008",
    fromAddr: "priya.nair@techflow.com",
    fromName: "Priya Nair",
    toAddr: "sales@inboxai.dev",
    subject: "Follow-up on pricing proposal",
    snippet: "Circling back on the pricing proposal you sent last week...",
    bodyText:
      "Hi, circling back on the pricing proposal you sent last week. Leadership approved the budget — what are the next steps to get started?",
    hours: 7,
    status: EmailStatus.READ,
    assigneeKey: "member",
    classification: {
      category: Category.SALES,
      priority: Priority.HIGH,
      summary: "Warm lead confirming budget approval and asking about next steps to onboard.",
      suggestedReply:
        "Fantastic news, Priya! Next step is a short kickoff call to set up your workspace. I'll send a contract and a scheduling link shortly.",
      sentiment: Sentiment.POSITIVE,
      confidence: 0.94,
      assignee: "Sales",
    },
  },
  {
    gmailId: "seed-msg-0009",
    threadId: "seed-thread-0009",
    fromAddr: "dev.support@apihub.com",
    fromName: "API Hub Support",
    toAddr: "support@inboxai.dev",
    subject: "Webhook deliveries are timing out",
    snippet: "We're seeing 504s on your webhook endpoint intermittently...",
    bodyText:
      "Hi team, we're seeing 504s on your webhook endpoint intermittently over the past hour. Can you check on your side?",
    hours: 8,
    status: EmailStatus.UNREAD,
    assigneeKey: "owner",
    classification: {
      category: Category.SUPPORT,
      priority: Priority.HIGH,
      summary: "Partner reporting intermittent 504 timeouts on the webhook endpoint.",
      suggestedReply:
        "Thanks for the report. We're looking into the webhook timeouts now and will share findings shortly. Could you send a couple of failing request IDs to speed up the trace?",
      sentiment: Sentiment.NEGATIVE,
      confidence: 0.91,
      assignee: "Support",
    },
  },
  {
    gmailId: "seed-msg-0010",
    threadId: "seed-thread-0010",
    fromAddr: "hello@newsletterly.com",
    fromName: "Newsletterly",
    toAddr: "support@inboxai.dev",
    subject: "This week in AI tooling",
    snippet: "The top stories in AI developer tooling this week...",
    bodyText:
      "The top stories in AI developer tooling this week: new model releases, agent frameworks, and more. Read on.",
    hours: 9,
    status: EmailStatus.READ,
    classification: {
      category: Category.GENERAL,
      priority: Priority.LOW,
      summary: "Marketing newsletter about AI developer tooling.",
      suggestedReply: "No action required — informational newsletter.",
      sentiment: Sentiment.NEUTRAL,
      confidence: 0.8,
      assignee: null,
    },
  },
  {
    gmailId: "seed-msg-0011",
    threadId: "seed-thread-0011",
    fromAddr: "tomas.k@fintechly.com",
    fromName: "Tomas Kowalski",
    toAddr: "billing@inboxai.dev",
    subject: "Question about invoice line items",
    snippet: "Could you clarify the overage charge on this month's invoice?",
    bodyText:
      "Hi, could you clarify the overage charge on this month's invoice? We weren't expecting the additional line item.",
    hours: 10,
    status: EmailStatus.READ,
    assigneeKey: "admin",
    classification: {
      category: Category.BILLING,
      priority: Priority.MEDIUM,
      summary: "Customer asking for clarification on an unexpected overage line item.",
      suggestedReply:
        "Hi Tomas, happy to break that down. The overage reflects usage above your plan's monthly limit — I'll send an itemized summary so you can see exactly where it came from.",
      sentiment: Sentiment.NEUTRAL,
      confidence: 0.87,
      assignee: "Finance",
    },
  },
  {
    gmailId: "seed-msg-0012",
    threadId: "seed-thread-0012",
    fromAddr: "megan.foster@retailco.com",
    fromName: "Megan Foster",
    toAddr: "support@inboxai.dev",
    subject: "How do I export my classified emails?",
    snippet: "I'd like to export the classification data to CSV...",
    bodyText:
      "Hi, I'd like to export the classification data to CSV for reporting. Is there a built-in way to do this?",
    hours: 11,
    status: EmailStatus.READ,
    assigneeKey: "member",
    classification: {
      category: Category.SUPPORT,
      priority: Priority.LOW,
      summary: "Customer asking how to export classification data to CSV.",
      suggestedReply:
        "Hi Megan, you can export from Settings > Data > Export, which generates a CSV of all classified emails. Let me know if you'd like an example.",
      sentiment: Sentiment.NEUTRAL,
      confidence: 0.89,
      assignee: "Support",
    },
  },
  {
    gmailId: "seed-msg-0013",
    threadId: "seed-thread-0013",
    fromAddr: "carlos.mendez@growthlab.io",
    fromName: "Carlos Mendez",
    toAddr: "sales@inboxai.dev",
    subject: "Can we get a discount for annual billing?",
    snippet: "We're ready to commit annually if there's a discount...",
    bodyText:
      "Hi, we're ready to commit annually if there's a discount available. What can you offer for a 12-month commitment?",
    hours: 12,
    status: EmailStatus.READ,
    assigneeKey: "member",
    classification: {
      category: Category.SALES,
      priority: Priority.MEDIUM,
      summary: "Lead asking about an annual-billing discount for a 12-month commitment.",
      suggestedReply:
        "Hi Carlos, we absolutely offer a discount for annual plans — typically two months free. I'll put together a quote for your team size and send it over today.",
      sentiment: Sentiment.POSITIVE,
      confidence: 0.9,
      assignee: "Sales",
    },
  },
  {
    gmailId: "seed-msg-0014",
    threadId: "seed-thread-0014",
    fromAddr: "security@vendortrust.com",
    fromName: "Vendor Trust",
    toAddr: "owner@inboxai.dev",
    subject: "Security questionnaire for procurement",
    snippet: "Please complete the attached security questionnaire...",
    bodyText:
      "Hello, as part of our procurement process please complete the attached security questionnaire. We need it before we can proceed.",
    hours: 13,
    status: EmailStatus.READ,
    assigneeKey: "owner",
    classification: {
      category: Category.GENERAL,
      priority: Priority.MEDIUM,
      summary: "Prospective vendor procurement team requesting completion of a security questionnaire.",
      suggestedReply:
        "Hi, thanks for sending this over. We'll complete the security questionnaire and return it within two business days. Let me know if there's a preferred format.",
      sentiment: Sentiment.NEUTRAL,
      confidence: 0.84,
      assignee: null,
    },
  },
  {
    gmailId: "seed-msg-0015",
    threadId: "seed-thread-0015",
    fromAddr: "nina.patel@designhub.com",
    fromName: "Nina Patel",
    toAddr: "support@inboxai.dev",
    subject: "Love the new dashboard!",
    snippet: "Just wanted to say the new dashboard is fantastic...",
    bodyText:
      "Just wanted to say the new dashboard is fantastic — the priority colors make triage so much faster. Great work!",
    hours: 14,
    status: EmailStatus.READ,
    classification: {
      category: Category.SUPPORT,
      priority: Priority.LOW,
      summary: "Customer sharing positive feedback about the new dashboard.",
      suggestedReply:
        "Thank you so much, Nina! That means a lot to the team. If there's anything you'd love to see next, we're all ears.",
      sentiment: Sentiment.POSITIVE,
      confidence: 0.96,
      assignee: null,
    },
  },
  {
    gmailId: "seed-msg-0016",
    threadId: "seed-thread-0016",
    fromAddr: "ops@warehouseplus.com",
    fromName: "Warehouse Plus",
    toAddr: "billing@inboxai.dev",
    subject: "Invoice reminder — payment due Friday",
    snippet: "A friendly reminder that invoice #10500 is due Friday...",
    bodyText:
      "A friendly reminder that invoice #10500 is due Friday. Please arrange payment at your earliest convenience.",
    hours: 16,
    status: EmailStatus.READ,
    assigneeKey: "admin",
    classification: {
      category: Category.BILLING,
      priority: Priority.MEDIUM,
      summary: "Vendor reminder that invoice #10500 is due Friday.",
      suggestedReply:
        "Thanks for the reminder — we'll ensure invoice #10500 is paid before Friday and send confirmation once processed.",
      sentiment: Sentiment.NEUTRAL,
      confidence: 0.86,
      assignee: "Finance",
    },
  },
  {
    gmailId: "seed-msg-0017",
    threadId: "seed-thread-0017",
    fromAddr: "recruiter@hirefast.com",
    fromName: "Hire Fast",
    toAddr: "owner@inboxai.dev",
    subject: "Partnership opportunity",
    snippet: "We'd love to explore a partnership between our platforms...",
    bodyText:
      "Hi, we'd love to explore a partnership between our platforms. Would you be open to a quick intro call next week?",
    hours: 18,
    status: EmailStatus.READ,
    classification: {
      category: Category.GENERAL,
      priority: Priority.LOW,
      summary: "Inbound partnership inquiry requesting an intro call.",
      suggestedReply:
        "Hi, thanks for reaching out! We're open to exploring a partnership. Could you share a bit more about what you have in mind before we book a call?",
      sentiment: Sentiment.POSITIVE,
      confidence: 0.82,
      assignee: null,
    },
  },
  {
    gmailId: "seed-msg-0018",
    threadId: "seed-thread-0018",
    fromAddr: "liam.wong@datacore.com",
    fromName: "Liam Wong",
    toAddr: "support@inboxai.dev",
    subject: "API rate limits keep blocking us",
    snippet: "We keep hitting rate limits during peak hours...",
    bodyText:
      "Hi, we keep hitting rate limits during peak hours and it's disrupting our sync jobs. Can we get a higher limit?",
    hours: 20,
    status: EmailStatus.READ,
    assigneeKey: "owner",
    classification: {
      category: Category.SUPPORT,
      priority: Priority.MEDIUM,
      summary: "Customer hitting API rate limits during peak hours and requesting a higher limit.",
      suggestedReply:
        "Hi Liam, thanks for flagging. We can raise your rate limit — I'll bump it now and follow up with the new thresholds so your sync jobs run smoothly.",
      sentiment: Sentiment.NEGATIVE,
      confidence: 0.9,
      assignee: "Support",
    },
  },
  {
    gmailId: "seed-msg-0019",
    threadId: "seed-thread-0019",
    fromAddr: "emma.stone@brightside.co",
    fromName: "Emma Stone",
    toAddr: "sales@inboxai.dev",
    subject: "Trial extension request",
    snippet: "Could we extend our trial by another week?",
    bodyText:
      "Hi, our trial ends tomorrow but we need a bit more time to get buy-in. Could we extend it by another week?",
    hours: 22,
    status: EmailStatus.READ,
    assigneeKey: "member",
    classification: {
      category: Category.SALES,
      priority: Priority.MEDIUM,
      summary: "Trial user requesting a one-week extension to secure internal buy-in.",
      suggestedReply:
        "Hi Emma, of course — I've extended your trial by a week. Let me know if a quick call with your stakeholders would help move things along.",
      sentiment: Sentiment.NEUTRAL,
      confidence: 0.91,
      assignee: "Sales",
    },
  },
  {
    gmailId: "seed-msg-0020",
    threadId: "seed-thread-0020",
    fromAddr: "unknown@random-mailer.net",
    fromName: "Random Mailer",
    toAddr: "support@inboxai.dev",
    subject: "RE: RE: RE: cheap SEO services",
    snippet: "Boost your rankings with our cheap SEO packages...",
    bodyText:
      "Boost your rankings overnight with our cheap SEO packages. Reply STOP to unsubscribe.",
    hours: 23,
    status: EmailStatus.ARCHIVED,
    classification: {
      category: Category.SPAM,
      priority: Priority.LOW,
      summary: "Unsolicited SEO services spam.",
      suggestedReply: "No reply needed — flagged as spam.",
      sentiment: Sentiment.NEUTRAL,
      confidence: 0.98,
      assignee: null,
    },
  },
]

async function main() {
  console.log("🌱 Seeding Inbox AI...")

  // Organization (idempotent by a stable id).
  const org = await prisma.organization.upsert({
    where: { id: "seed-org-inbox-ai" },
    update: { name: "Inbox AI Demo Co." },
    create: { id: "seed-org-inbox-ai", name: "Inbox AI Demo Co." },
  })

  // Users (idempotent by unique email).
  const owner = await prisma.user.upsert({
    where: { email: "owner@inboxai.dev" },
    update: { name: "Ava Owner", role: Role.OWNER, orgId: org.id },
    create: {
      email: "owner@inboxai.dev",
      name: "Ava Owner",
      role: Role.OWNER,
      supabaseId: "seed-supabase-owner",
      orgId: org.id,
    },
  })

  const admin = await prisma.user.upsert({
    where: { email: "admin@inboxai.dev" },
    update: { name: "Ben Admin", role: Role.ADMIN, orgId: org.id },
    create: {
      email: "admin@inboxai.dev",
      name: "Ben Admin",
      role: Role.ADMIN,
      supabaseId: "seed-supabase-admin",
      orgId: org.id,
    },
  })

  const member = await prisma.user.upsert({
    where: { email: "member@inboxai.dev" },
    update: { name: "Cleo Member", role: Role.MEMBER, orgId: org.id },
    create: {
      email: "member@inboxai.dev",
      name: "Cleo Member",
      role: Role.MEMBER,
      supabaseId: "seed-supabase-member",
      orgId: org.id,
    },
  })

  const usersByKey = { owner, admin, member } as const

  // Mailbox (idempotent by stable id).
  const mailbox = await prisma.mailbox.upsert({
    where: { id: "seed-mailbox-primary" },
    update: { email: "support@inboxai.dev", orgId: org.id },
    create: {
      id: "seed-mailbox-primary",
      email: "support@inboxai.dev",
      provider: "gmail",
      historyId: "1",
      orgId: org.id,
    },
  })

  // Automation rules (idempotent by stable ids).
  const rules: Array<{
    id: string
    name: string
    conditionField: RuleField
    operator: RuleOperator
    value: string
    actionType: RuleActionType
    actionValue: string
  }> = [
    {
      id: "seed-rule-invoice",
      name: "Invoices to Finance",
      conditionField: RuleField.SUBJECT,
      operator: RuleOperator.CONTAINS,
      value: "invoice",
      actionType: RuleActionType.ASSIGN,
      actionValue: "Finance",
    },
    {
      id: "seed-rule-vip",
      name: "VIP customers are high priority",
      conditionField: RuleField.BODY,
      operator: RuleOperator.CONTAINS,
      value: "VIP",
      actionType: RuleActionType.SET_PRIORITY,
      actionValue: "HIGH",
    },
    {
      id: "seed-rule-refund",
      name: "Refunds to Support team",
      conditionField: RuleField.BODY,
      operator: RuleOperator.CONTAINS,
      value: "refund",
      actionType: RuleActionType.SET_TEAM,
      actionValue: "Support",
    },
  ]

  for (const r of rules) {
    await prisma.automationRule.upsert({
      where: { id: r.id },
      update: {
        name: r.name,
        conditionField: r.conditionField,
        operator: r.operator,
        value: r.value,
        actionType: r.actionType,
        actionValue: r.actionValue,
        enabled: true,
        orgId: org.id,
      },
      create: { ...r, enabled: true, orgId: org.id },
    })
  }

  // Emails + classifications — skip entirely if any emails already exist.
  const existingEmails = await prisma.email.count({
    where: { mailboxId: mailbox.id },
  })

  if (existingEmails > 0) {
    console.log(
      `↩︎  ${existingEmails} email(s) already present — skipping email seed.`,
    )
  } else {
    for (const e of SEED_EMAILS) {
      const assignee = e.assigneeKey ? usersByKey[e.assigneeKey] : undefined
      await prisma.email.create({
        data: {
          gmailId: e.gmailId,
          threadId: e.threadId,
          fromAddr: e.fromAddr,
          fromName: e.fromName,
          toAddr: e.toAddr,
          subject: e.subject,
          snippet: e.snippet,
          bodyText: e.bodyText,
          bodyHtml: `<p>${e.bodyText}</p>`,
          receivedAt: hoursAgo(e.hours),
          status: e.status,
          assigneeId: assignee?.id ?? null,
          mailboxId: mailbox.id,
          raw: {
            id: e.gmailId,
            threadId: e.threadId,
            labelIds: ["INBOX"],
            snippet: e.snippet,
          },
          classification: {
            create: {
              category: e.classification.category,
              priority: e.classification.priority,
              summary: e.classification.summary,
              suggestedReply: e.classification.suggestedReply,
              sentiment: e.classification.sentiment,
              confidence: e.classification.confidence,
              assignee: e.classification.assignee ?? null,
              model: "gpt-4o-mini",
            },
          },
        },
      })
    }
    console.log(`📧  Created ${SEED_EMAILS.length} emails with classifications.`)

    // A few tasks tied to the most actionable emails.
    const outageEmail = await prisma.email.findUnique({
      where: { gmailId: "seed-msg-0001" },
    })
    const refundEmail = await prisma.email.findUnique({
      where: { gmailId: "seed-msg-0006" },
    })
    const salesEmail = await prisma.email.findUnique({
      where: { gmailId: "seed-msg-0008" },
    })

    await prisma.task.createMany({
      data: [
        {
          title: "Resolve production outage for Acme Corp",
          status: TaskStatus.IN_PROGRESS,
          dueAt: hoursAgo(-2),
          emailId: outageEmail?.id ?? null,
          assigneeId: owner.id,
          orgId: org.id,
        },
        {
          title: "Process refund for Alex Rivera",
          status: TaskStatus.OPEN,
          dueAt: hoursAgo(-24),
          emailId: refundEmail?.id ?? null,
          assigneeId: member.id,
          orgId: org.id,
        },
        {
          title: "Send onboarding contract to TechFlow",
          status: TaskStatus.OPEN,
          dueAt: hoursAgo(-48),
          emailId: salesEmail?.id ?? null,
          assigneeId: member.id,
          orgId: org.id,
        },
        {
          title: "Complete vendor security questionnaire",
          status: TaskStatus.OPEN,
          dueAt: hoursAgo(-72),
          assigneeId: owner.id,
          orgId: org.id,
        },
      ],
    })
    console.log("✅  Created 4 tasks.")
  }

  console.log("🌱 Seed complete.")
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
