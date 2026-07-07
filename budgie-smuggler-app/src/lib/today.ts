import { startOfMonth } from "date-fns";
import { getOpenActionItems } from "@/lib/action-items";
import { prisma } from "@/lib/prisma";

function toNumber(value: { toNumber(): number } | number | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  return typeof value === "number" ? value : value.toNumber();
}

export async function getTodayData(userId: string) {
  const actionItems = await getOpenActionItems(userId, 10);

  if (!prisma) {
    return {
      source: "mock" as const,
      actionItems,
      reality: {
        cashFlow: -842,
        spending: 2840,
        income: 1998,
        needsReview: 8,
        missingDebtDetails: 2,
      },
    };
  }

  const monthStart = startOfMonth(new Date());
  const [debits, credits, stagedNeedsReview] = await Promise.all([
    prisma.transaction.aggregate({
      where: {
        ownerUserId: userId,
        postedDate: { gte: monthStart },
        direction: "debit",
        cashFlowRole: "spending",
      },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: {
        ownerUserId: userId,
        postedDate: { gte: monthStart },
        direction: "credit",
        cashFlowRole: "income",
      },
      _sum: { amount: true },
    }),
    prisma.importedTransaction.count({
      where: {
        ownerUserId: userId,
        reviewStatus: { in: ["needs_review", "suggested"] },
      },
    }),
  ]);

  const spending = toNumber(debits._sum.amount);
  const income = toNumber(credits._sum.amount);

  return {
    source: "database" as const,
    actionItems,
    reality: {
      cashFlow: income - spending,
      spending,
      income,
      needsReview: stagedNeedsReview,
      missingDebtDetails: 0,
    },
  };
}
