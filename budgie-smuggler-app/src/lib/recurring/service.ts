import type { Prisma } from "@prisma/client";
import { createActionItems } from "@/lib/action-items";
import { prisma } from "@/lib/prisma";
import { buildRecurringActionItems } from "./actions";
import { detectRecurringItems, type DetectedRecurringItem } from "./detection";

type DecimalLike = Prisma.Decimal | number | null | undefined;
type RecurringSource = "mock" | "database";

export type RecurringItemUpdateInput = {
  status?: string;
  usageType?: string;
  categoryId?: string | null;
  notes?: string | null;
};

export type RecurringItemView = {
  id: string;
  merchantName: string;
  normalizedMerchantKey: string;
  usageType: string;
  categoryId: string | null;
  amountMin: number;
  amountMax: number;
  typicalAmount: number;
  cadence: string;
  nextExpectedDate: string | null;
  lastSeenDate: string;
  transactionCount: number;
  status: string;
  priceIncreaseDetected: boolean;
  increaseAmount: number | null;
  source: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RecurringItemsResult = {
  items: RecurringItemView[];
  source: RecurringSource;
};

export type RecurringItemUpdateResult = {
  item: RecurringItemView;
  source: RecurringSource;
};

function toNumber(value: DecimalLike) {
  if (value === null || value === undefined) {
    return null;
  }

  return typeof value === "number" ? value : value.toNumber();
}

function toDateString(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : null;
}

function mapRecurringItem(row: Prisma.RecurringItemGetPayload<Record<string, never>>): RecurringItemView {
  return {
    id: row.id,
    merchantName: row.merchantName,
    normalizedMerchantKey: row.normalizedMerchantKey,
    usageType: row.usageType,
    categoryId: row.categoryId,
    amountMin: toNumber(row.amountMin) ?? 0,
    amountMax: toNumber(row.amountMax) ?? 0,
    typicalAmount: toNumber(row.typicalAmount) ?? 0,
    cadence: row.cadence,
    nextExpectedDate: toDateString(row.nextExpectedDate),
    lastSeenDate: toDateString(row.lastSeenDate) ?? "",
    transactionCount: row.transactionCount,
    status: row.status,
    priceIncreaseDetected: row.priceIncreaseDetected,
    increaseAmount: toNumber(row.increaseAmount),
    source: row.source,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function recurringData(userId: string, item: DetectedRecurringItem, status: string) {
  return {
    ownerUserId: userId,
    merchantName: item.merchantName,
    normalizedMerchantKey: item.normalizedMerchantKey,
    usageType: item.usageType,
    categoryId: item.categoryId,
    amountMin: item.amountMin,
    amountMax: item.amountMax,
    typicalAmount: item.typicalAmount,
    cadence: item.cadence,
    nextExpectedDate: item.nextExpectedDate,
    lastSeenDate: item.lastSeenDate,
    transactionCount: item.transactionCount,
    status,
    priceIncreaseDetected: item.priceIncreaseDetected,
    increaseAmount: item.increaseAmount,
    source: "rule",
  };
}

export async function listRecurringItems(userId: string): Promise<RecurringItemView[]> {
  if (!prisma) {
    return [
      {
        id: "mock-recurring",
        merchantName: "Sample Subscription",
        normalizedMerchantKey: "sample subscription",
        usageType: "unknown",
        categoryId: null,
        amountMin: 19.99,
        amountMax: 24.99,
        typicalAmount: 21.66,
        cadence: "monthly",
        nextExpectedDate: new Date().toISOString().slice(0, 10),
        lastSeenDate: new Date().toISOString().slice(0, 10),
        transactionCount: 3,
        status: "suspected",
        priceIncreaseDetected: true,
        increaseAmount: 5,
        source: "rule",
        notes: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
  }

  const rows = await prisma.recurringItem.findMany({
    where: { ownerUserId: userId },
    orderBy: [{ status: "asc" }, { nextExpectedDate: "asc" }, { merchantName: "asc" }],
  });

  return rows.map(mapRecurringItem);
}

export async function listRecurringItemsWithSource(userId: string): Promise<RecurringItemsResult> {
  return {
    items: await listRecurringItems(userId),
    source: prisma ? "database" : "mock",
  };
}

export async function updateRecurringItem(userId: string, id: string, input: RecurringItemUpdateInput): Promise<RecurringItemUpdateResult | null> {
  if (!prisma) {
    const item = (await listRecurringItems(userId))[0];
    return item ? { item, source: "mock" } : null;
  }

  const existing = await prisma.recurringItem.findFirst({
    where: { id, ownerUserId: userId },
  });

  if (!existing) {
    return null;
  }

  const row = await prisma.recurringItem.update({
    where: { id },
    data: input,
  });

  return { item: mapRecurringItem(row), source: "database" };
}

export async function scanRecurringItems(userId: string) {
  if (!prisma) {
    return { scanned: 0, detected: 1, source: "mock" as const };
  }

  const transactions = await prisma.transaction.findMany({
    where: {
      ownerUserId: userId,
      direction: "debit",
      reviewStatus: "accepted",
    },
    orderBy: { postedDate: "desc" },
    take: 1500,
  });
  const chronologicalTransactions = [...transactions].reverse();

  const detected = detectRecurringItems(
    chronologicalTransactions.map((transaction) => ({
      id: transaction.id,
      postedDate: transaction.postedDate,
      merchantName: transaction.merchantName,
      description: transaction.description,
      amount: toNumber(transaction.amount) ?? 0,
      direction: transaction.direction,
      usageType: transaction.usageType,
      categoryId: transaction.categoryId,
    })),
  );

  await prisma.$transaction(async (tx) => {
    const existing = detected.length
      ? await tx.recurringItem.findMany({
          where: {
            ownerUserId: userId,
            OR: detected.map((item) => ({
              normalizedMerchantKey: item.normalizedMerchantKey,
              cadence: item.cadence,
            })),
          },
        })
      : [];

    const existingByKey = new Map(existing.map((item) => [`${item.normalizedMerchantKey}:${item.cadence}`, item]));
    const preservedStatuses = new Set(["confirmed", "ignored", "cancelled"]);

    for (const item of detected) {
      const existingItem = existingByKey.get(`${item.normalizedMerchantKey}:${item.cadence}`);
      const status = existingItem && preservedStatuses.has(existingItem.status) ? existingItem.status : item.status;
      const row = await tx.recurringItem.upsert({
        where: {
          ownerUserId_normalizedMerchantKey_cadence: {
            ownerUserId: userId,
            normalizedMerchantKey: item.normalizedMerchantKey,
            cadence: item.cadence,
          },
        },
        create: recurringData(userId, item, status),
        update: recurringData(userId, item, status),
      });

      await tx.recurringTransactionLink.createMany({
        data: item.transactionIds.map((transactionId) => ({
          ownerUserId: userId,
          recurringItemId: row.id,
          transactionId,
        })),
        skipDuplicates: true,
      });
    }
  });

  await refreshRecurringActionItems(userId);

  return { scanned: transactions.length, detected: detected.length, source: "database" as const };
}

export async function refreshRecurringActionItems(userId: string) {
  const items = await listRecurringItems(userId);
  return createActionItems(userId, buildRecurringActionItems(userId, items));
}
