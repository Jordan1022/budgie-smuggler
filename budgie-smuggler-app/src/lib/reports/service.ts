import { startOfMonth } from "date-fns";
import { listDebtAccounts, summarizeDebt } from "@/lib/debt/service";
import { prisma } from "@/lib/prisma";
import { listRecurringItems } from "@/lib/recurring/service";

export type UsageReportRow = {
  usageType: string;
  income: number;
  spending: number;
  net: number;
};

export type ReportsData = {
  source: "mock" | "database";
  household: {
    income: number;
    spending: number;
    net: number;
    debtBalance: number;
    monthlyInterest: number;
    recurringMonthly: number;
  };
  usageRows: UsageReportRow[];
  debtWarnings: Array<{
    id: string;
    name: string;
    balance: number;
    apr: number | null | undefined;
    utilization: number | null;
    pressureLabel: string;
    pressureReasons: string[];
  }>;
  subscriptionCutList: Array<{
    id: string;
    merchantName: string;
    typicalAmount: number;
    cadence: string;
    usageType: string;
    status: string;
    monthlyEstimate: number;
    reason: string;
  }>;
};

function monthlyMultiplier(cadence: string) {
  if (cadence === "weekly") return 4.33;
  if (cadence === "biweekly") return 2.17;
  if (cadence === "quarterly") return 0.33;
  if (cadence === "yearly") return 0.083;
  return 1;
}

export async function getReportsData(userId: string): Promise<ReportsData> {
  if (!prisma) {
    return {
      source: "mock",
      household: {
        income: 4200,
        spending: 5100,
        net: -900,
        debtBalance: 2400,
        monthlyInterest: 59.98,
        recurringMonthly: 184,
      },
      usageRows: [
        { usageType: "personal", income: 3500, spending: 3900, net: -400 },
        { usageType: "business", income: 700, spending: 1200, net: -500 },
      ],
      debtWarnings: [
        {
          id: "mock-debt",
          name: "Sample Credit Card",
          balance: 2400,
          apr: 29.99,
          utilization: 80,
          pressureLabel: "high",
          pressureReasons: ["Utilization is 80% or higher"],
        },
      ],
      subscriptionCutList: [
        {
          id: "mock-recurring",
          merchantName: "Sample Subscription",
          typicalAmount: 24.99,
          cadence: "monthly",
          usageType: "unknown",
          status: "suspected",
          monthlyEstimate: 24.99,
          reason: "Unknown usage and suspected status.",
        },
      ],
    };
  }

  const monthStart = startOfMonth(new Date());
  const [incomeRows, spendingRows, debtSummary, debts, recurringItems] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["usageType"],
      where: { ownerUserId: userId, direction: "credit", cashFlowRole: "income", postedDate: { gte: monthStart } },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ["usageType"],
      where: { ownerUserId: userId, direction: "debit", cashFlowRole: "spending", postedDate: { gte: monthStart } },
      _sum: { amount: true },
    }),
    summarizeDebt(userId),
    listDebtAccounts(userId),
    listRecurringItems(userId),
  ]);

  const usageTypes = new Set([...incomeRows.map((row) => row.usageType), ...spendingRows.map((row) => row.usageType), "personal", "business"]);
  const incomeByUsage = new Map(incomeRows.map((row) => [row.usageType, row._sum.amount?.toNumber() ?? 0]));
  const spendingByUsage = new Map(spendingRows.map((row) => [row.usageType, row._sum.amount?.toNumber() ?? 0]));

  const usageRows = Array.from(usageTypes)
    .map((usageType) => {
      const income = incomeByUsage.get(usageType) ?? 0;
      const spending = spendingByUsage.get(usageType) ?? 0;
      return { usageType, income, spending, net: income - spending };
    })
    .sort((left, right) => left.usageType.localeCompare(right.usageType));

  const recurringActive = recurringItems.filter((item) => item.status === "suspected" || item.status === "confirmed");
  const subscriptionCutList = recurringActive
    .map((item) => {
      const monthlyEstimate = item.typicalAmount * monthlyMultiplier(item.cadence);
      const reasons = [];
      if (item.status === "suspected") reasons.push("suspected");
      if (item.usageType === "unknown" || item.usageType === "mixed") reasons.push("unclear usage");
      if (item.priceIncreaseDetected) reasons.push("price increased");
      if (monthlyEstimate >= 50) reasons.push("meaningful monthly spend");

      return {
        id: item.id,
        merchantName: item.merchantName,
        typicalAmount: item.typicalAmount,
        cadence: item.cadence,
        usageType: item.usageType,
        status: item.status,
        monthlyEstimate,
        reason: reasons.length ? `${reasons.join(", ")}.` : "Recurring charge worth a deliberate keep/cut decision.",
      };
    })
    .sort((left, right) => right.monthlyEstimate - left.monthlyEstimate)
    .slice(0, 10);

  const income = usageRows.reduce((sum, row) => sum + row.income, 0);
  const spending = usageRows.reduce((sum, row) => sum + row.spending, 0);

  return {
    source: "database",
    household: {
      income,
      spending,
      net: income - spending,
      debtBalance: debtSummary.totalBalance,
      monthlyInterest: debtSummary.estimatedMonthlyInterest,
      recurringMonthly: recurringActive.reduce((sum, item) => sum + item.typicalAmount * monthlyMultiplier(item.cadence), 0),
    },
    usageRows,
    debtWarnings: debts
      .filter((debt) => debt.pressureLabel !== "normal")
      .map((debt) => ({
        id: debt.id,
        name: debt.name,
        balance: debt.balance,
        apr: debt.apr,
        utilization: debt.utilization,
        pressureLabel: debt.pressureLabel,
        pressureReasons: debt.pressureReasons,
      })),
    subscriptionCutList,
  };
}
