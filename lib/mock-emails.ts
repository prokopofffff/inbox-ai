import "server-only";

import type {
  Category,
  EmailWithClassification,
  Priority,
  Sentiment,
  UserSummary,
} from "@/lib/types";

/**
 * Deterministic mock inbox data.
 *
 * Used whenever no database is configured (local dev without DATABASE_URL) so
 * the Inbox list and detail pages render with realistic content instead of an
 * empty/error state. The dashboard also derives its "recent activity" from
 * these rows so the two surfaces stay consistent.
 */

interface MockEmailSeed {
  fromName: string;
  fromAddr: string;
  subject: string;
  summary: string;
  body: string;
  category: Category;
  priority: Priority;
  sentiment: Sentiment;
  confidence: number;
  minutesAgo: number;
  suggestedReply: string;
}

const SEEDS: MockEmailSeed[] = [
  {
    fromName: "Sarah Chen",
    fromAddr: "sarah@acme.io",
    subject: "Unable to access billing dashboard",
    summary: "Customer locked out of billing dashboard, needs urgent access.",
    body: "Hi team,\n\nI've been trying to log into the billing dashboard all morning and keep getting an 'access denied' error. We have an invoice due today and I really need to get in. Can someone help ASAP?\n\nThanks,\nSarah",
    category: "BILLING",
    priority: "HIGH",
    sentiment: "NEGATIVE",
    confidence: 0.95,
    minutesAgo: 2,
    suggestedReply:
      "Hi Sarah,\n\nSorry for the trouble accessing the billing dashboard. I've just reset your permissions — please try logging in again and let me know if the issue persists. Regarding the invoice due today, we've noted your account so there won't be any late penalties.\n\nBest,\nThe Support Team",
  },
  {
    fromName: "Marcus Reid",
    fromAddr: "m.reid@globex.com",
    subject: "Interested in enterprise plan pricing",
    summary: "Prospect asking about enterprise tier pricing and volume seats.",
    body: "Hello,\n\nWe're evaluating tools for our 200-person support org and your product looks like a great fit. Could you share enterprise pricing and whether you offer volume discounts on seats?\n\nBest,\nMarcus Reid",
    category: "SALES",
    priority: "MEDIUM",
    sentiment: "POSITIVE",
    confidence: 0.91,
    minutesAgo: 14,
    suggestedReply:
      "Hi Marcus,\n\nThanks for your interest! I'd love to walk you through our enterprise plan, which includes volume discounts starting at 50 seats. Are you free for a 20-minute call this week?\n\nBest,\nThe Sales Team",
  },
  {
    fromName: "Priya Patel",
    fromAddr: "priya@initech.co",
    subject: "Bug: attachments not loading on mobile",
    summary: "Attachments fail to load on the mobile app for this user.",
    body: "Hi,\n\nSince the latest update, email attachments won't load on the iOS app — they just spin forever. Desktop works fine. This is blocking my team.\n\nPriya",
    category: "SUPPORT",
    priority: "HIGH",
    sentiment: "NEGATIVE",
    confidence: 0.88,
    minutesAgo: 31,
    suggestedReply:
      "Hi Priya,\n\nThanks for flagging this. We've reproduced the attachment loading issue on iOS and our engineering team is deploying a fix shortly. I'll update you the moment it's live.\n\nBest,\nThe Support Team",
  },
  {
    fromName: "Tom Becker",
    fromAddr: "tom@umbrella.net",
    subject: "Thanks for the quick response!",
    summary: "Customer thanking the team for a fast resolution.",
    body: "Just wanted to say thanks — you resolved my issue in under an hour. Fantastic support!\n\nTom",
    category: "SUPPORT",
    priority: "LOW",
    sentiment: "POSITIVE",
    confidence: 0.97,
    minutesAgo: 60,
    suggestedReply:
      "Hi Tom,\n\nThank you so much for the kind words — it made our day! Don't hesitate to reach out if you need anything else.\n\nBest,\nThe Support Team",
  },
  {
    fromName: "David Kim",
    fromAddr: "d.kim@hooli.com",
    subject: "How do I set up automated email rules?",
    summary: "User asking how to configure automation rules.",
    body: "Hi there,\n\nI'd like to automatically route invoices to our finance team. How do I set up automation rules for that?\n\nThanks,\nDavid",
    category: "SUPPORT",
    priority: "LOW",
    sentiment: "NEUTRAL",
    confidence: 0.9,
    minutesAgo: 180,
    suggestedReply:
      "Hi David,\n\nGreat question! Head to Automation in the sidebar, create a new rule with condition 'Subject contains invoice' and action 'Assign to Finance'. It'll run on every incoming email automatically.\n\nBest,\nThe Support Team",
  },
  {
    fromName: "Elena Rossi",
    fromAddr: "elena@vandelay.com",
    subject: "Invoice #4821 seems incorrect",
    summary: "Customer disputes a line item on their latest invoice.",
    body: "Hello,\n\nInvoice #4821 charges us for 12 seats but we only have 8 active users. Could you review and correct this?\n\nRegards,\nElena",
    category: "BILLING",
    priority: "MEDIUM",
    sentiment: "NEGATIVE",
    confidence: 0.86,
    minutesAgo: 240,
    suggestedReply:
      "Hi Elena,\n\nThanks for catching that. You're right — invoice #4821 should reflect 8 seats. I've issued a corrected invoice and a credit for the difference. Apologies for the mix-up.\n\nBest,\nThe Billing Team",
  },
  {
    fromName: "Noah Williams",
    fromAddr: "noah@stark.io",
    subject: "Feature request: dark mode for reports",
    summary: "User requesting a dark theme for exported reports.",
    body: "Hi,\n\nLove the product! Any chance of adding a dark mode option for exported PDF reports? Would be easier on the eyes for our night shift.\n\nNoah",
    category: "GENERAL",
    priority: "LOW",
    sentiment: "NEUTRAL",
    confidence: 0.83,
    minutesAgo: 320,
    suggestedReply:
      "Hi Noah,\n\nThanks for the suggestion — dark mode for exported reports is a great idea. I've added it to our feature backlog and shared it with the product team.\n\nBest,\nThe Support Team",
  },
  {
    fromName: "Grace Liu",
    fromAddr: "grace@wayne.com",
    subject: "Contract renewal — next steps",
    summary: "Account manager coordinating the upcoming renewal.",
    body: "Hi team,\n\nOur annual contract is up for renewal next month. Could you send over the renewal paperwork and confirm our current terms?\n\nThanks,\nGrace",
    category: "SALES",
    priority: "MEDIUM",
    sentiment: "POSITIVE",
    confidence: 0.92,
    minutesAgo: 420,
    suggestedReply:
      "Hi Grace,\n\nGreat to hear you'd like to renew! I've attached the renewal paperwork reflecting your current terms. Let me know if you'd like to discuss any adjustments.\n\nBest,\nThe Sales Team",
  },
];

/** Build the full list of mock emails (with classifications) at call time. */
export function getMockEmails(now = new Date()): EmailWithClassification[] {
  return SEEDS.map((m, i) => {
    const receivedAt = new Date(now.getTime() - m.minutesAgo * 60 * 1000);
    const id = `mock-${i}`;
    return {
      id,
      gmailId: `mock-gmail-${i}`,
      threadId: `mock-thread-${i}`,
      fromAddr: m.fromAddr,
      fromName: m.fromName,
      toAddr: "team@inboxai.dev",
      subject: m.subject,
      snippet: m.summary,
      bodyText: m.body,
      bodyHtml: null,
      receivedAt,
      status: i < 3 ? "UNREAD" : "READ",
      assigneeId: null,
      mailboxId: "mock-mailbox",
      classification: {
        id: `mock-cls-${i}`,
        emailId: id,
        category: m.category,
        priority: m.priority,
        summary: m.summary,
        suggestedReply: m.suggestedReply,
        sentiment: m.sentiment,
        confidence: m.confidence,
        assignee: null,
        model: "mock",
        createdAt: receivedAt,
      },
      assignee: null,
      mailbox: {
        id: "mock-mailbox",
        email: "team@inboxai.dev",
        provider: "gmail",
      },
    } satisfies EmailWithClassification;
  });
}

/** Look up a single mock email by id (used by the detail route in mock mode). */
export function getMockEmailById(
  id: string,
  now = new Date(),
): EmailWithClassification | null {
  return getMockEmails(now).find((e) => e.id === id) ?? null;
}

/** A small roster of assignable users for mock mode. */
export const MOCK_USERS: UserSummary[] = [
  { id: "mock-user-1", email: "alex@inboxai.dev", name: "Alex Morgan", role: "ADMIN" },
  { id: "mock-user-2", email: "jordan@inboxai.dev", name: "Jordan Lee", role: "MEMBER" },
  { id: "mock-user-3", email: "sam@inboxai.dev", name: "Sam Rivera", role: "MEMBER" },
];
