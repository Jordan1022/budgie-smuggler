import { endOfMonth, format, startOfMonth } from "date-fns";
import type { BudgetProgress, DashboardSummary } from "@/types/domain";

export function normalizeCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export function computeBudgetProgress(limit: number, spent: number) {
  const safeLimit = Math.max(0, limit);
  const safeSpent = Math.max(0, spent);
  const remaining = normalizeCurrency(safeLimit - safeSpent);
  const percentUsed = safeLimit === 0 ? 0 : normalizeCurrency((safeSpent / safeLimit) * 100);

  return {
    limit: normalizeCurrency(safeLimit),
    spent: normalizeCurrency(safeSpent),
    remaining,
    percentUsed,
  };
}

export function summarizeDashboard(
  monthDate: Date,
  budgetRows: Pick<BudgetProgress, "limit" | "spent">[],
  lastSyncedAt: string | null,
): DashboardSummary {
  const totalBudget = normalizeCurrency(budgetRows.reduce((sum, row) => sum + row.limit, 0));
  const totalSpent = normalizeCurrency(budgetRows.reduce((sum, row) => sum + row.spent, 0));
  const totalRemaining = normalizeCurrency(totalBudget - totalSpent);

  return {
    monthLabel: format(monthDate, "MMMM yyyy"),
    totalSpent,
    totalBudget,
    totalRemaining,
    progress: totalBudget === 0 ? 0 : normalizeCurrency((totalSpent / totalBudget) * 100),
    lastSyncedAt,
  };
}

export function getCurrentMonthWindow(reference = new Date()) {
  return {
    start: startOfMonth(reference),
    end: endOfMonth(reference),
  };
}
