export type BudgetProgress = {
  budgetId: string;
  categoryId: string;
  categoryName: string;
  limit: number;
  spent: number;
  remaining: number;
  percentUsed: number;
};

export type DashboardSummary = {
  monthLabel: string;
  totalSpent: number;
  totalBudget: number;
  totalRemaining: number;
  progress: number;
  lastSyncedAt: string | null;
};

export type BudgetThreshold = number;

export type AlertRuleConfig = {
  thresholdPercents: BudgetThreshold[];
  weeklyDigestDay: number;
  unusualSpendMultiplier: number;
};
