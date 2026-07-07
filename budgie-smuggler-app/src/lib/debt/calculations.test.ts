import { addDays, subDays } from "date-fns";
import { describe, expect, it } from "vitest";
import { calculateUtilization, estimateMonthlyInterest, getDebtPressure, rankPayoffCandidates } from "./calculations";

describe("debt calculations", () => {
  it("calculates card utilization as a rounded percentage", () => {
    expect(calculateUtilization({ balance: 820, creditLimit: 1000 })).toBe(82);
    expect(calculateUtilization({ balance: 0, creditLimit: 1000 })).toBe(0);
  });

  it("returns null utilization when credit limit is missing or zero", () => {
    expect(calculateUtilization({ balance: 820, creditLimit: null })).toBeNull();
    expect(calculateUtilization({ balance: 820, creditLimit: 0 })).toBeNull();
  });

  it("estimates monthly interest from APR", () => {
    expect(estimateMonthlyInterest({ balance: 1200, apr: 29.99 })).toBeCloseTo(29.99, 2);
    expect(estimateMonthlyInterest({ balance: 1200, apr: null })).toBeNull();
  });

  it("labels missing debt details before other pressure labels", () => {
    const pressure = getDebtPressure({ balance: 2000, apr: null, minimumPayment: 80, nextDueDate: null });

    expect(pressure.label).toBe("missing_info");
    expect(pressure.reasons).toContain("APR missing");
  });

  it("labels debt due soon as urgent", () => {
    const pressure = getDebtPressure({ balance: 2000, apr: 32, minimumPayment: 40, nextDueDate: addDays(new Date(), 3) });

    expect(pressure.label).toBe("urgent");
    expect(pressure.reasons).toContain("Payment due within 7 days");
  });

  it("labels high APR or high utilization as high pressure", () => {
    expect(getDebtPressure({ balance: 2000, apr: 32, minimumPayment: 40, nextDueDate: addDays(new Date(), 20) }).label).toBe("high");
    expect(
      getDebtPressure({
        balance: 820,
        apr: 18,
        minimumPayment: 40,
        nextDueDate: addDays(new Date(), 20),
        creditLimit: 1000,
      }).label,
    ).toBe("high");
  });

  it("keeps closed or zero-balance debt normal when details exist", () => {
    expect(getDebtPressure({ balance: 0, apr: 29.99, minimumPayment: 0, nextDueDate: subDays(new Date(), 1) }).label).toBe("normal");
  });

  it("ranks payoff candidates by highest APR and ignores missing APR", () => {
    const ranked = rankPayoffCandidates([
      { id: "a", apr: 18, balance: 100, minimumPayment: 20 },
      { id: "missing", apr: null, balance: 300, minimumPayment: 30 },
      { id: "b", apr: 29.99, balance: 500, minimumPayment: 40 },
    ]);

    expect(ranked.map((debt) => debt.id)).toEqual(["b", "a"]);
  });
});
