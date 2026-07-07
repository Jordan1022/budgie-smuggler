import { env, isXaiConfigured } from "@/lib/env";
import { redactForAi, type RedactionSummary } from "@/lib/ai/redaction";
import { importClassificationSchema, moneyBriefSchema, moneyChatSchema, type ImportClassification, type MoneyBrief, type MoneyChatAnswer } from "@/lib/ai/schemas";
import type { MoneyContext } from "@/lib/ai/money-context";

export type ClassifyImportInput = {
  importedTransactionId: string;
  date: string;
  accountName: string;
  accountType?: string | null;
  accountUsageType: string;
  description: string;
  amount: number;
  direction: string;
};

function buildFallbackClassification(rows: ClassifyImportInput[]): ImportClassification {
  return {
    transactions: rows.map((row) => ({
      importedTransactionId: row.importedTransactionId,
      suggestedCategory: null,
      usageType: row.accountUsageType === "business" ? "business" : "unknown",
      cashFlowRole: row.direction === "credit" ? "income" : "spending",
      subscriptionLikelihood: 0,
      duplicateSuspicion: 0,
      confidence: 0.35,
      reason: "Grok is not configured. This fallback keeps the item reviewable.",
      question: "What is this transaction for?",
    })),
  };
}

export async function classifyImportedTransactions(rows: ClassifyImportInput[]): Promise<{
  source: "xai" | "fallback";
  redactionSummary: RedactionSummary;
  classification: ImportClassification;
}> {
  const { redacted, summary } = redactForAi(rows);

  if (!isXaiConfigured()) {
    return {
      source: "fallback",
      redactionSummary: summary,
      classification: buildFallbackClassification(rows),
    };
  }

  const config = env();
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.XAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.XAI_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'Classify imported financial transactions. Return only JSON matching this shape: {"transactions":[{"importedTransactionId":"string","suggestedCategory":string|null,"usageType":"personal|business|mixed|unknown","cashFlowRole":"spending|income|transfer|debt_payment|interest|fee|refund|other","subscriptionLikelihood":number,"duplicateSuspicion":number,"confidence":number,"reason":"string","question":string|null}]}',
        },
        {
          role: "user",
          content: JSON.stringify({ transactions: redacted }),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`xAI classification failed with status ${response.status}.`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  const parsedJson = typeof content === "string" ? JSON.parse(content) : content;

  return {
    source: "xai",
    redactionSummary: summary,
    classification: importClassificationSchema.parse(parsedJson),
  };
}

function fallbackBrief(context: MoneyContext): MoneyBrief {
  const risks: string[] = [];
  if (context.reports.household.net < 0) {
    risks.push(`Cash flow is negative by $${Math.abs(context.reports.household.net).toFixed(2)} this month.`);
  }
  if (context.reports.household.monthlyInterest > 0) {
    risks.push(`Debt interest is estimated around $${context.reports.household.monthlyInterest.toFixed(2)} per month.`);
  }
  if (context.reports.subscriptionCutList.length > 0) {
    risks.push(`${context.reports.subscriptionCutList.length} recurring charges need a keep/cut decision.`);
  }

  return {
    headline: context.reports.household.net < 0 ? "You are not guessing anymore: cash flow is negative." : "You have a current money snapshot.",
    bluntSummary:
      context.reports.household.net < 0
        ? "Spending is above income. The next move is reduce recurring drag, stop high-APR card use, and clear open action items."
        : "Income is ahead of spending, but debt and recurring charges still need active review.",
    topRisks: risks.slice(0, 5),
    nextActions: context.openActions.slice(0, 5).map((item) => item.title),
    subscriptionsToReview: context.reports.subscriptionCutList.slice(0, 5).map((item) => `${item.merchantName}: $${item.monthlyEstimate.toFixed(2)}/mo`),
    confidence: 0.55,
  };
}

function fallbackChat(context: MoneyContext, question: string): MoneyChatAnswer {
  const brief = fallbackBrief(context);
  return {
    answer: `Grok is not configured, so this is rule-based. Question: "${question}". ${brief.bluntSummary}`,
    evidence: [
      `Household net: $${context.reports.household.net.toFixed(2)}`,
      `Debt balance: $${context.reports.household.debtBalance.toFixed(2)}`,
      `Recurring monthly estimate: $${context.reports.household.recurringMonthly.toFixed(2)}`,
      `Open action items: ${context.openActions.length}`,
    ],
    nextActions: brief.nextActions,
    confidence: 0.45,
  };
}

async function callGrokJson<T>({
  context,
  system,
  user,
  schema,
}: {
  context: unknown;
  system: string;
  user: string;
  schema: { parse(value: unknown): T };
}) {
  const { redacted } = redactForAi(context);
  const config = env();
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.XAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.XAI_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify({ request: user, context: redacted }) },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`xAI request failed with status ${response.status}.`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  const parsedJson = typeof content === "string" ? JSON.parse(content) : content;
  return schema.parse(parsedJson);
}

export async function generateMoneyBrief(context: MoneyContext): Promise<{ source: "xai" | "fallback"; brief: MoneyBrief; redactionSummary: RedactionSummary }> {
  const { summary } = redactForAi(context);

  if (!isXaiConfigured()) {
    return { source: "fallback", brief: fallbackBrief(context), redactionSummary: summary };
  }

  const brief = await callGrokJson({
    context,
    user: "Generate today's blunt financial brief.",
    schema: moneyBriefSchema,
    system:
      'You are a blunt household finance operator. Return only JSON: {"headline":"string","bluntSummary":"string","topRisks":["string"],"nextActions":["string"],"subscriptionsToReview":["string"],"confidence":number}. Be direct, practical, and do not shame.',
  });

  return { source: "xai", brief, redactionSummary: summary };
}

export async function answerMoneyQuestion(context: MoneyContext, question: string): Promise<{ source: "xai" | "fallback"; answer: MoneyChatAnswer; redactionSummary: RedactionSummary }> {
  const { summary } = redactForAi(context);

  if (!isXaiConfigured()) {
    return { source: "fallback", answer: fallbackChat(context, question), redactionSummary: summary };
  }

  const answer = await callGrokJson({
    context,
    user: question,
    schema: moneyChatSchema,
    system:
      'You are a blunt household finance operator answering questions from current app data. Return only JSON: {"answer":"string","evidence":["string"],"nextActions":["string"],"confidence":number}. Be direct, practical, and do not invent data.',
  });

  return { source: "xai", answer, redactionSummary: summary };
}
