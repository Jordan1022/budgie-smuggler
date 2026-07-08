import { z } from "zod";

export const importClassificationSchema = z.object({
  transactions: z.array(
    z.object({
      importedTransactionId: z.string(),
      suggestedCategory: z.string().nullable(),
      usageType: z.enum(["personal", "business", "mixed", "unknown"]),
      cashFlowRole: z.enum(["spending", "income", "transfer", "debt_payment", "interest", "fee", "refund", "other"]),
      subscriptionLikelihood: z.number().min(0).max(1),
      duplicateSuspicion: z.number().min(0).max(1),
      confidence: z.number().min(0).max(1),
      reason: z.string(),
      question: z.string().nullable(),
    }),
  ),
});

export type ImportClassification = z.infer<typeof importClassificationSchema>;

export const moneyBriefSchema = z.object({
  headline: z.string(),
  bluntSummary: z.string(),
  topRisks: z.array(z.string()).max(5),
  nextActions: z.array(z.string()).max(5),
  subscriptionsToReview: z.array(z.string()).max(5),
  confidence: z.number().min(0).max(1),
});

export const moneyChatSchema = z.object({
  answer: z.string(),
  evidence: z.array(z.string()).max(6),
  nextActions: z.array(z.string()).max(5),
  confidence: z.number().min(0).max(1),
});

export type MoneyBrief = z.infer<typeof moneyBriefSchema>;
export type MoneyChatAnswer = z.infer<typeof moneyChatSchema>;
