import { addDays, subDays } from "date-fns";
import { describe, expect, it } from "vitest";
import { buildDebtActionItems } from "./actions";

describe("debt action items", () => {
  it("creates blunt action items for missing details, due dates, utilization, and interest pressure", () => {
    const actions = buildDebtActionItems("user-id", [
      {
        id: "d1",
        name: "Visa",
        balance: 900,
        apr: null,
        minimumPayment: 35,
        nextDueDate: null,
        creditLimit: 1000,
      },
      {
        id: "d2",
        name: "Amex",
        balance: 820,
        apr: 29.99,
        minimumPayment: 50,
        nextDueDate: addDays(new Date(), 5),
        creditLimit: 1000,
      },
    ]);

    expect(actions.map((item) => item.type)).toContain("complete_debt_details");
    expect(actions.map((item) => item.type)).toContain("upcoming_debt_due");
    expect(actions.map((item) => item.type)).toContain("high_utilization_debt");
    expect(actions.map((item) => item.type)).toContain("debt_interest_pressure");
    expect(actions.every((item) => item.relatedEntityType === "debt_account")).toBe(true);
  });

  it("does not create pressure actions for zero-balance debts", () => {
    const actions = buildDebtActionItems("user-id", [
      {
        id: "d1",
        name: "Paid Card",
        balance: 0,
        apr: 29.99,
        minimumPayment: 0,
        nextDueDate: addDays(new Date(), 5),
        creditLimit: 1000,
      },
    ]);

    expect(actions).toEqual([]);
  });

  it("creates an urgent overdue action item for overdue due dates", () => {
    const actions = buildDebtActionItems("user-id", [
      {
        id: "d1",
        name: "Visa",
        balance: 900,
        apr: 18,
        minimumPayment: 35,
        nextDueDate: subDays(new Date(), 2),
        creditLimit: 2000,
      },
    ]);

    expect(actions).toEqual([
      expect.objectContaining({
        type: "upcoming_debt_due",
        title: "Visa: payment is overdue",
        priority: "urgent",
      }),
    ]);
  });
});
