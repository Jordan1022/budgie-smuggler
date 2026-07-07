import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { createActionItems, type ActionItemInput } from "@/lib/action-items";
import { parseCsvTransactions, type ParsedCsvTransaction } from "@/lib/imports/csv";
import { buildDuplicateFingerprint } from "@/lib/imports/normalize";
import { prisma } from "@/lib/prisma";

type ImportRowSummaryInput = {
  reviewStatus: string;
  duplicateTransactionId?: string | null;
};

export function summarizeImportRows(rows: ImportRowSummaryInput[]) {
  return {
    total: rows.length,
    needsReview: rows.filter((row) => row.reviewStatus === "needs_review").length,
    duplicateCandidates: rows.filter((row) => row.duplicateTransactionId).length,
    suggested: rows.filter((row) => row.reviewStatus === "suggested").length,
  };
}

export function buildImportActionItems(input: {
  importBatchId: string;
  totalRows: number;
  needsReview: number;
  duplicateCandidates: number;
}): ActionItemInput[] {
  const items: ActionItemInput[] = [];

  if (input.needsReview > 0) {
    items.push({
      type: "review_import",
      title: `Review ${input.needsReview} imported transactions`,
      body: `${input.totalRows} transactions were imported. Confirm the unclear rows before reports count them as reliable.`,
      priority: "high",
      relatedEntityType: "import_batch",
      relatedEntityId: input.importBatchId,
      source: "system",
    });
  }

  if (input.duplicateCandidates > 0) {
    items.push({
      type: "check_duplicates",
      title: `Check ${input.duplicateCandidates} possible duplicate transactions`,
      body: "These look like transactions already in the ledger. Confirm before accepting them.",
      priority: "normal",
      relatedEntityType: "import_batch",
      relatedEntityId: input.importBatchId,
      source: "system",
    });
  }

  return items;
}

function toNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  return typeof value === "number" ? value : value.toNumber();
}

function getDateRange(rows: ParsedCsvTransaction[]) {
  const parsedDates = rows.map((row) => row.parsedDate).sort();
  return {
    start: new Date(parsedDates[0]),
    end: new Date(parsedDates[parsedDates.length - 1]),
  };
}

export async function importCsvForAccount(input: {
  userId: string;
  bankAccountId: string;
  fileName: string;
  csvText: string;
}) {
  const parsed = parseCsvTransactions(input.csvText);

  if (!prisma) {
    const summary = summarizeImportRows(parsed.rows.map(() => ({ reviewStatus: "needs_review" })));
    return {
      source: "mock" as const,
      importBatchId: "mock-import",
      parsed,
      summary,
    };
  }

  if (parsed.rows.length === 0) {
    throw new Error(parsed.errors[0] ?? "No importable rows found.");
  }

  const db = prisma;
  const account = await db.bankAccount.findFirst({
    where: {
      id: input.bankAccountId,
      ownerUserId: input.userId,
    },
  });

  if (!account) {
    throw new Error("Account not found.");
  }

  const fileHash = createHash("sha256").update(input.csvText).digest("hex");
  const dateRange = getDateRange(parsed.rows);

  const result = await db.$transaction(async (tx) => {
    const batch = await tx.importBatch.create({
      data: {
        ownerUserId: input.userId,
        bankAccountId: input.bankAccountId,
        fileName: input.fileName,
        fileType: "csv",
        fileHash,
        parserStatus: parsed.errors.length > 0 ? "needs_review" : "parsed",
        detectedStartDate: dateRange.start,
        detectedEndDate: dateRange.end,
      },
    });

    const existing = await tx.transaction.findMany({
      where: {
        ownerUserId: input.userId,
        bankAccountId: input.bankAccountId,
        postedDate: {
          in: parsed.rows.map((row) => new Date(row.parsedDate)),
        },
      },
      select: {
        id: true,
        postedDate: true,
        amount: true,
        direction: true,
        description: true,
        merchantName: true,
      },
    });

    const existingByFingerprint = new Map(
      existing.map((transaction) => [
        buildDuplicateFingerprint({
          bankAccountId: input.bankAccountId,
          parsedDate: transaction.postedDate.toISOString().slice(0, 10),
          amount: toNumber(transaction.amount),
          direction: transaction.direction,
          normalizedDescription: transaction.merchantName ?? transaction.description ?? "",
        }),
        transaction.id,
      ]),
    );

    const staged = await Promise.all(
      parsed.rows.map((row) => {
        const duplicateTransactionId =
          existingByFingerprint.get(
            buildDuplicateFingerprint({
              bankAccountId: input.bankAccountId,
              parsedDate: row.parsedDate,
              amount: row.amount,
              direction: row.direction,
              normalizedDescription: row.normalizedDescription,
            }),
          ) ?? null;

        return tx.importedTransaction.create({
          data: {
            importBatchId: batch.id,
            ownerUserId: input.userId,
            bankAccountId: input.bankAccountId,
            rawDate: row.rawDate,
            parsedDate: new Date(row.parsedDate),
            rawDescription: row.rawDescription,
            normalizedDescription: row.normalizedDescription,
            amount: row.amount,
            direction: row.direction,
            detectedUsageType: account.usageType,
            detectedCashFlowRole: row.direction === "credit" ? "income" : "spending",
            duplicateTransactionId,
            confidence: duplicateTransactionId ? 0.95 : 0.55,
            reviewStatus: "needs_review",
            sourceRow: row.sourceRow,
          },
        });
      }),
    );

    await tx.bankAccount.update({
      where: { id: input.bankAccountId },
      data: {
        lastImportedAt: new Date(),
      },
    });

    return { batch, staged };
  });

  const summary = summarizeImportRows(result.staged);
  await createActionItems(
    input.userId,
    buildImportActionItems({
      importBatchId: result.batch.id,
      totalRows: summary.total,
      needsReview: summary.needsReview,
      duplicateCandidates: summary.duplicateCandidates,
    }),
  );

  return {
    source: "database" as const,
    importBatchId: result.batch.id,
    parsed,
    summary,
  };
}
