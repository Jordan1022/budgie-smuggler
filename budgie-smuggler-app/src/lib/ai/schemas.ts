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
