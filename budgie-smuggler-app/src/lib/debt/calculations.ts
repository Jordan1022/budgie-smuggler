import { differenceInCalendarDays, startOfDay } from "date-fns";

export type DebtMathInput = {
  id?: string;
  name?: string;
  balance: number;
  apr: number | null;
  minimumPayment: number | null;
  nextDueDate?: Date | string | null;
  creditLimit?: number | null;
};

export type DebtPressure = {
  label: "missing_info" | "urgent" | "high" | "normal";
  reasons: string[];
};

function roundCents(value: number) {
  return Math.round(value * 100) / 100;
}

export function parseDebtDate(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : startOfDay(date);
}

export function calculateUtilization(input: Pick<DebtMathInput, "balance" | "creditLimit">): number | null {
  if (!input.creditLimit || input.creditLimit <= 0) {
    return null;
  }

  return Math.round((input.balance / input.creditLimit) * 100);
}

export function estimateMonthlyInterest(input: Pick<DebtMathInput, "balance" | "apr">): number | null {
  if (input.apr === null || input.apr === undefined || input.balance <= 0) {
    return null;
  }

  return roundCents(input.balance * (input.apr / 100 / 12));
}

export function getDebtPressure(input: DebtMathInput): DebtPressure {
  const reasons: string[] = [];

  if (input.apr === null || input.apr === undefined) {
    reasons.push("APR missing");
  }

  if (input.minimumPayment === null || input.minimumPayment === undefined) {
    reasons.push("Minimum payment missing");
  }

  if (input.balance > 0 && !parseDebtDate(input.nextDueDate)) {
    reasons.push("Due date missing");
  }

  if (reasons.length > 0) {
    return { label: "missing_info", reasons };
  }

  const dueDate = parseDebtDate(input.nextDueDate);
  if (input.balance > 0 && dueDate) {
    const daysUntilDue = differenceInCalendarDays(dueDate, startOfDay(new Date()));
    if (daysUntilDue < 0) {
      return { label: "urgent", reasons: ["Payment is overdue"] };
    }
    if (daysUntilDue <= 7) {
      return { label: "urgent", reasons: ["Payment due within 7 days"] };
    }
  }

  const utilization = calculateUtilization(input);
  const highReasons: string[] = [];
  if (input.apr !== null && input.apr !== undefined && input.apr >= 25 && input.balance > 0) {
    highReasons.push("APR is 25% or higher");
  }

  if (utilization !== null && utilization >= 80) {
    highReasons.push("Utilization is 80% or higher");
  }

  if (highReasons.length > 0) {
    return { label: "high", reasons: highReasons };
  }

  return { label: "normal", reasons: [] };
}

export function rankPayoffCandidates<T extends DebtMathInput>(debts: T[]): T[] {
  return debts
    .filter((debt) => debt.balance > 0 && debt.apr !== null && debt.apr !== undefined)
    .sort((left, right) => {
      const aprDiff = (right.apr ?? 0) - (left.apr ?? 0);
      return aprDiff === 0 ? right.balance - left.balance : aprDiff;
    });
}
