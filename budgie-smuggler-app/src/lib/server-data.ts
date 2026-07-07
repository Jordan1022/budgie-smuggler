import { Prisma } from "@prisma/client";
import { formatISO, startOfMonth } from "date-fns";
import { computeBudgetProgress, summarizeDashboard } from "@/lib/budget";
import { MOCK_BUDGET_PROGRESS, MOCK_INSIGHTS, MOCK_TRANSACTIONS } from "@/lib/mock-data";
import { prisma } from "@/lib/prisma";
import type { BudgetProgress } from "@/types/domain";

function toNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  return typeof value === "number" ? value : value.toNumber();
}

export async function getDashboardData(userId: string) {
  if (!prisma) {
    return {
      summary: summarizeDashboard(new Date(), MOCK_BUDGET_PROGRESS, formatISO(new Date())),
      progress: MOCK_BUDGET_PROGRESS,
      source: "mock" as const,
    };
  }
  const db = prisma;

  const monthStart = startOfMonth(new Date());
  const [budgets, lastItem] = await Promise.all([
    db.monthlyBudget.findMany({
      where: {
        ownerUserId: userId,
        monthStart,
      },
      include: {
        category: true,
      },
      orderBy: {
        category: {
          name: "asc",
        },
      },
    }),
    db.plaidItem.findFirst({
      where: { ownerUserId: userId },
      orderBy: { lastSyncAt: "desc" },
      select: { lastSyncAt: true },
    }),
  ]);

  const progress = await Promise.all(
    budgets.map(async (budget): Promise<BudgetProgress> => {
      const spentRow = await db.transaction.aggregate({
        where: {
          ownerUserId: userId,
          categoryId: budget.categoryId,
          postedDate: {
            gte: monthStart,
          },
          direction: "debit",
        },
        _sum: {
          amount: true,
        },
      });

      const spent = toNumber(spentRow._sum.amount);
      const computed = computeBudgetProgress(toNumber(budget.amountLimit), spent);

      return {
        budgetId: budget.id,
        categoryId: budget.categoryId,
        categoryName: budget.category.name,
        limit: computed.limit,
        spent: computed.spent,
        remaining: computed.remaining,
        percentUsed: computed.percentUsed,
      };
    }),
  );

  return {
    summary: summarizeDashboard(new Date(), progress, lastItem?.lastSyncAt?.toISOString() ?? null),
    progress,
    source: "database" as const,
  };
}

export async function getTransactions(userId: string) {
  if (!prisma) {
    return {
      transactions: MOCK_TRANSACTIONS,
      source: "mock" as const,
    };
  }
  const db = prisma;

  const rows = await db.transaction.findMany({
    where: {
      ownerUserId: userId,
    },
    include: {
      category: true,
    },
    orderBy: {
      postedDate: "desc",
    },
    take: 200,
  });

  return {
    transactions: rows.map((row) => ({
      id: row.id,
      postedDate: row.postedDate.toISOString().slice(0, 10),
      merchantName: row.merchantName,
      description: row.description,
      amount: toNumber(row.amount),
      direction: row.direction,
      categoryId: row.categoryId,
      userOverrideCategory: row.userOverrideCategory,
      rawCategory: row.rawCategory,
      categoryName: row.category?.name ?? "Uncategorized",
    })),
    source: "database" as const,
  };
}

export async function getImportedTransactionsForReview(userId: string) {
  if (!prisma) {
    return {
      transactions: [
        {
          id: "00000000-0000-4000-8000-000000000001",
          parsedDate: "2026-06-01",
          rawDescription: "Amazon Marketplace",
          amount: 42.18,
          direction: "debit",
          detectedCategory: null,
          detectedUsageType: "unknown",
          detectedCashFlowRole: "spending",
          reviewStatus: "needs_review",
          duplicateTransactionId: null,
          confidence: 0.55,
          accountName: "Sample Checking",
        },
      ],
      source: "mock" as const,
    };
  }
  const db = prisma;

  const rows = await db.importedTransaction.findMany({
    where: {
      ownerUserId: userId,
      reviewStatus: {
        in: ["needs_review", "suggested"],
      },
    },
    include: {
      bankAccount: true,
    },
    orderBy: [{ parsedDate: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  return {
    transactions: rows.map((row) => ({
      id: row.id,
      parsedDate: row.parsedDate.toISOString().slice(0, 10),
      rawDescription: row.rawDescription,
      amount: toNumber(row.amount),
      direction: row.direction,
      detectedCategory: row.detectedCategory,
      detectedUsageType: row.detectedUsageType,
      detectedCashFlowRole: row.detectedCashFlowRole,
      reviewStatus: row.reviewStatus,
      duplicateTransactionId: row.duplicateTransactionId,
      confidence: toNumber(row.confidence),
      accountName: row.bankAccount.name,
    })),
    source: "database" as const,
  };
}

export async function getAccounts(userId: string) {
  if (!prisma) {
    return {
      accounts: [
        {
          id: "mock-account",
          name: "Sample Checking",
          type: "checking",
          usageType: "personal",
          sourceType: "manual",
          lastImportedAt: null,
        },
      ],
      source: "mock" as const,
    };
  }
  const db = prisma;

  const rows = await db.bankAccount.findMany({
    where: {
      ownerUserId: userId,
    },
    orderBy: [{ sourceType: "asc" }, { name: "asc" }],
  });

  return {
    accounts: rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      usageType: row.usageType,
      sourceType: row.sourceType,
      lastImportedAt: row.lastImportedAt?.toISOString() ?? null,
    })),
    source: "database" as const,
  };
}

export async function getBudgets(userId: string) {
  if (!prisma) {
    return {
      budgets: MOCK_BUDGET_PROGRESS,
      source: "mock" as const,
    };
  }

  return getDashboardData(userId).then((result) => ({ budgets: result.progress, source: result.source }));
}

export async function getInsights(userId: string) {
  if (!prisma) {
    return {
      insights: MOCK_INSIGHTS,
      source: "mock" as const,
    };
  }
  const db = prisma;

  const rows = await db.insightSnapshot.findMany({
    where: {
      ownerUserId: userId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 20,
  });

  return {
    insights: rows.map((row) => ({
      id: row.id,
      summary: row.summary,
      details: JSON.stringify(row.details),
    })),
    source: "database" as const,
  };
}

export async function getCategories(userId: string) {
  if (!prisma) {
    return [
      { id: "cat-groceries", name: "Groceries", color: "#16a34a" },
      { id: "cat-transport", name: "Transport", color: "#2563eb" },
      { id: "cat-dining", name: "Dining", color: "#f59e0b" },
    ];
  }

  const db = prisma;
  return db.category.findMany({
    where: {
      ownerUserId: userId,
    },
    orderBy: {
      name: "asc",
    },
  });
}

export async function getAlertPreferences(userId: string) {
  const defaults = {
    enabled: true,
    thresholdPercents: [50, 80, 100],
    weeklyDigestDay: 1,
    unusualSpendMultiplier: 1.3,
    channels: {
      email: true,
      push: false,
      inApp: true,
    },
    notifyOn: {
      threshold: true,
      overspend: true,
      unusualSpend: true,
      weeklyDigest: false,
    },
  };

  if (!prisma) {
    return { alerts: defaults, source: "mock" as const };
  }

  const row = await prisma.alert.findFirst({
    where: {
      ownerUserId: userId,
      type: "preferences",
    },
  });

  if (!row || typeof row.config !== "object" || row.config === null) {
    return { alerts: defaults, source: "database" as const };
  }

  const config = row.config as Record<string, unknown>;
  const channels = config.channels && typeof config.channels === "object" ? (config.channels as Record<string, unknown>) : {};
  const notifyOn = config.notifyOn && typeof config.notifyOn === "object" ? (config.notifyOn as Record<string, unknown>) : {};

  return {
    alerts: {
      ...defaults,
      ...config,
      enabled: row.enabled,
      channels: {
        ...defaults.channels,
        ...channels,
      },
      notifyOn: {
        ...defaults.notifyOn,
        ...notifyOn,
      },
    },
    source: "database" as const,
  };
}
