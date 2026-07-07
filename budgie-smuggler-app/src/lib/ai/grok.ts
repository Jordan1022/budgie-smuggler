import { env, isXaiConfigured } from "@/lib/env";
import { redactForAi, type RedactionSummary } from "@/lib/ai/redaction";
import { importClassificationSchema, type ImportClassification } from "@/lib/ai/schemas";

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
