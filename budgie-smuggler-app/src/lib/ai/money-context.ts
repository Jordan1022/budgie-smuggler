import { getOpenActionItems } from "@/lib/action-items";
import { prisma } from "@/lib/prisma";
import { getReportsData } from "@/lib/reports/service";

export type MoneyContext = {
  reports: Awaited<ReturnType<typeof getReportsData>>;
  openActions: Awaited<ReturnType<typeof getOpenActionItems>>;
  recentTransactions: Array<{
    postedDate: string;
    merchantName: string | null;
    description: string | null;
    amount: number;
    direction: string;
    usageType: string;
    cashFlowRole: string;
  }>;
};

function toNumber(value: { toNumber(): number } | number | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  return typeof value === "number" ? value : value.toNumber();
}

export async function buildMoneyContext(userId: string): Promise<MoneyContext> {
  const [reports, openActions] = await Promise.all([getReportsData(userId), getOpenActionItems(userId, 20)]);

  if (!prisma) {
    return {
      reports,
      openActions,
      recentTransactions: [],
    };
  }

  const recentTransactions = await prisma.transaction.findMany({
    where: { ownerUserId: userId },
    orderBy: { postedDate: "desc" },
    take: 40,
  });

  return {
    reports,
    openActions,
    recentTransactions: recentTransactions.map((transaction) => ({
      postedDate: transaction.postedDate.toISOString().slice(0, 10),
      merchantName: transaction.merchantName,
      description: transaction.description,
      amount: toNumber(transaction.amount),
      direction: transaction.direction,
      usageType: transaction.usageType,
      cashFlowRole: transaction.cashFlowRole,
    })),
  };
}
