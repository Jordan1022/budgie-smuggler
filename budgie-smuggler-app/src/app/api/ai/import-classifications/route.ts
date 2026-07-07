import { NextResponse } from "next/server";
import { z } from "zod";
import { classifyImportedTransactions } from "@/lib/ai/grok";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getRouteUser, unauthorized } from "@/lib/route-auth";

const requestSchema = z.object({
  importedTransactionIds: z.array(z.string().uuid()).min(1).max(100),
});

function toNumber(value: { toNumber(): number } | number | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  return typeof value === "number" ? value : value.toNumber();
}

export async function POST(request: Request) {
  const user = await getRouteUser();
  if (!user) {
    return unauthorized();
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (!prisma) {
    const classification = await classifyImportedTransactions(
      parsed.data.importedTransactionIds.map((id) => ({
        importedTransactionId: id,
        date: "2026-06-01",
        accountName: "Sample Checking",
        accountType: "checking",
        accountUsageType: "unknown",
        description: "Sample transaction",
        amount: 10,
        direction: "debit",
      })),
    );

    return NextResponse.json({ ...classification, source: "mock" });
  }

  const rows = await prisma.importedTransaction.findMany({
    where: {
      ownerUserId: user.id,
      id: { in: parsed.data.importedTransactionIds },
      reviewStatus: { in: ["needs_review", "suggested"] },
    },
    include: {
      bankAccount: true,
    },
  });

  if (rows.length === 0) {
    return NextResponse.json({ error: "No reviewable imported transactions found." }, { status: 404 });
  }

  try {
    const result = await classifyImportedTransactions(
      rows.map((row) => ({
        importedTransactionId: row.id,
        date: row.parsedDate.toISOString().slice(0, 10),
        accountName: row.bankAccount.name,
        accountType: row.bankAccount.type,
        accountUsageType: row.bankAccount.usageType,
        description: row.rawDescription,
        amount: toNumber(row.amount),
        direction: row.direction,
      })),
    );

    await prisma.$transaction(async (tx) => {
      const aiRun = await tx.aiRun.create({
        data: {
          ownerUserId: user.id,
          provider: result.source === "xai" ? "xai" : "fallback",
          model: result.source === "xai" ? env().XAI_MODEL : "fallback",
          purpose: "classification",
          redactionLevel: "transaction_facts",
          promptVersion: "import-classification-v1",
          inputSummary: {
            transactionCount: rows.length,
            redactionSummary: result.redactionSummary,
          },
          outputStatus: "completed",
        },
      });

      for (const finding of result.classification.transactions) {
        const confidence = Math.max(0, Math.min(1, finding.confidence));
        const reviewStatus = confidence >= 0.7 ? "suggested" : "needs_review";

        await tx.aiFinding.create({
          data: {
            aiRunId: aiRun.id,
            ownerUserId: user.id,
            findingType: "import_transaction_classification",
            structuredOutput: finding,
            confidence,
            relatedEntityType: "imported_transaction",
            relatedEntityId: finding.importedTransactionId,
            reviewStatus: "suggested",
          },
        });

        await tx.importedTransaction.updateMany({
          where: {
            id: finding.importedTransactionId,
            ownerUserId: user.id,
            reviewStatus: { in: ["needs_review", "suggested"] },
          },
          data: {
            detectedCategory: finding.suggestedCategory,
            detectedUsageType: finding.usageType,
            detectedCashFlowRole: finding.cashFlowRole,
            confidence,
            reviewStatus,
          },
        });
      }
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Classification failed." }, { status: 502 });
  }
}
