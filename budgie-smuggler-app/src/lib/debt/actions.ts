import { differenceInCalendarDays, startOfDay } from "date-fns";
import type { ActionItemInput } from "@/lib/action-items";
import { calculateUtilization, estimateMonthlyInterest, parseDebtDate } from "./calculations";

export type DebtActionInput = {
  id: string;
  name: string;
  balance: number;
  apr: number | null;
  minimumPayment: number | null;
  nextDueDate?: Date | string | null;
  creditLimit?: number | null;
};

function baseAction(debt: DebtActionInput): Pick<ActionItemInput, "relatedEntityType" | "relatedEntityId" | "source"> {
  return {
    relatedEntityType: "debt_account",
    relatedEntityId: debt.id,
    source: "rule",
  };
}

export function buildDebtActionItems(_userId: string, debts: DebtActionInput[]): ActionItemInput[] {
  const items: ActionItemInput[] = [];

  for (const debt of debts) {
    if (debt.balance <= 0) {
      continue;
    }

    const missing: string[] = [];
    if (debt.apr === null || debt.apr === undefined) {
      missing.push("APR");
    }
    if (debt.minimumPayment === null || debt.minimumPayment === undefined) {
      missing.push("minimum payment");
    }
    if (!parseDebtDate(debt.nextDueDate)) {
      missing.push("due date");
    }

    if (missing.length > 0) {
      items.push({
        ...baseAction(debt),
        type: "complete_debt_details",
        title: `${debt.name}: fill in ${missing.join(", ")}`,
        body: "APR, minimum payment, and due date are required before this debt can be managed correctly.",
        priority: "urgent",
      });
    }

    const dueDate = parseDebtDate(debt.nextDueDate);
    if (dueDate) {
      const daysUntilDue = differenceInCalendarDays(dueDate, startOfDay(new Date()));
      if (daysUntilDue < 0) {
        items.push({
          ...baseAction(debt),
          type: "upcoming_debt_due",
          title: `${debt.name}: payment is overdue`,
          body: "This debt is past due. Catch it up before late fees and interest stack further.",
          priority: "urgent",
          dueDate,
        });
      } else if (daysUntilDue <= 7) {
        items.push({
          ...baseAction(debt),
          type: "upcoming_debt_due",
          title: `${debt.name}: payment due in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}`,
          body: "Do not let a late fee stack on top of interest.",
          priority: "urgent",
          dueDate,
        });
      }
    }

    const utilization = calculateUtilization(debt);
    if (utilization !== null && utilization >= 80) {
      items.push({
        ...baseAction(debt),
        type: "high_utilization_debt",
        title: `${debt.name}: ${utilization}% utilized`,
        body: "Over 80% utilized. Stop using this card unless survival requires it.",
        priority: "high",
      });
    }

    const monthlyInterest = estimateMonthlyInterest(debt);
    if (debt.apr !== null && debt.apr !== undefined && debt.apr >= 25 && monthlyInterest !== null && monthlyInterest >= 10) {
      items.push({
        ...baseAction(debt),
        type: "debt_interest_pressure",
        title: `${debt.name}: interest is eating about $${monthlyInterest.toFixed(2)}/month`,
        body: "High APR debt is not background noise. This needs priority.",
        priority: "high",
      });
    }
  }

  return items;
}
