import { describe, expect, it } from "vitest";
import {
  buildOverspendDedupeKey,
  buildThresholdDedupeKey,
  evaluateTriggeredThresholds,
  shouldTriggerUnusualSpend,
} from "@/lib/alerts";

describe("alert utilities", () => {
  it("builds deterministic dedupe keys", () => {
    expect(
      buildThresholdDedupeKey({
        budgetId: "budget-1",
        month: "2026-03",
        threshold: 80,
      }),
    ).toBe("threshold:budget-1:2026-03:80");

    expect(buildOverspendDedupeKey({ budgetId: "budget-1", month: "2026-03" })).toBe("overspend:budget-1:2026-03");
  });

  it("detects reached thresholds", () => {
    expect(evaluateTriggeredThresholds(85, [50, 80, 100])).toEqual([50, 80]);
    expect(evaluateTriggeredThresholds(120, [50, 80, 100])).toEqual([50, 80, 100]);
  });

  it("evaluates unusual spend", () => {
    expect(
      shouldTriggerUnusualSpend({
        current: 260,
        trailingAverage: 200,
        multiplier: 1.2,
      }),
    ).toBe(true);

    expect(
      shouldTriggerUnusualSpend({
        current: 220,
        trailingAverage: 200,
        multiplier: 1.2,
      }),
    ).toBe(false);
  });
});
