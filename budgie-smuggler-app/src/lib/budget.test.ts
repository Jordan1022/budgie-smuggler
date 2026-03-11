import { describe, expect, it } from "vitest";
import { computeBudgetProgress, summarizeDashboard } from "@/lib/budget";

describe("computeBudgetProgress", () => {
  it("calculates remaining and percentage", () => {
    const result = computeBudgetProgress(1000, 250);

    expect(result.limit).toBe(1000);
    expect(result.spent).toBe(250);
    expect(result.remaining).toBe(750);
    expect(result.percentUsed).toBe(25);
  });

  it("handles zero budget safely", () => {
    const result = computeBudgetProgress(0, 25);

    expect(result.percentUsed).toBe(0);
    expect(result.remaining).toBe(-25);
  });
});

describe("summarizeDashboard", () => {
  it("aggregates totals", () => {
    const summary = summarizeDashboard(
      new Date("2026-03-06T00:00:00.000Z"),
      [
        { limit: 1000, spent: 200 },
        { limit: 500, spent: 300 },
      ],
      "2026-03-06T12:00:00.000Z",
    );

    expect(summary.totalBudget).toBe(1500);
    expect(summary.totalSpent).toBe(500);
    expect(summary.totalRemaining).toBe(1000);
    expect(summary.progress).toBeCloseTo(33.33, 1);
    expect(summary.monthLabel).toContain("March");
  });
});
