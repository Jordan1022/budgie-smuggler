import { describe, expect, it } from "vitest";
import { buildRecurringActionItems, type RecurringActionInput } from "./actions";

function item(overrides: Partial<RecurringActionInput>): RecurringActionInput {
  return {
    id: overrides.id ?? "r1",
    merchantName: overrides.merchantName ?? "Netflix",
    status: overrides.status ?? "suspected",
    usageType: overrides.usageType ?? "personal",
    cadence: overrides.cadence ?? "monthly",
    typicalAmount: overrides.typicalAmount ?? 19.99,
    priceIncreaseDetected: overrides.priceIncreaseDetected ?? false,
    increaseAmount: overrides.increaseAmount ?? null,
  };
}

describe("recurring action items", () => {
  it("creates review actions for suspected recurring items", () => {
    const actions = buildRecurringActionItems("user-id", [item({ id: "r1", status: "suspected" })]);

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      type: "review_suspected_recurring",
      priority: "normal",
      relatedEntityType: "recurring_item",
      relatedEntityId: "r1",
    });
  });

  it("creates high-priority price increase actions", () => {
    const actions = buildRecurringActionItems("user-id", [item({ id: "r2", priceIncreaseDetected: true, increaseAmount: 5 })]);

    expect(actions.map((action) => action.type)).toContain("review_price_increase");
    expect(actions.find((action) => action.type === "review_price_increase")?.priority).toBe("high");
  });

  it("creates usage review actions for mixed and unknown usage", () => {
    const actions = buildRecurringActionItems("user-id", [
      item({ id: "r3", usageType: "mixed" }),
      item({ id: "r4", usageType: "unknown", status: "confirmed" }),
    ]);

    expect(actions.filter((action) => action.type === "review_cross_usage_recurring")).toHaveLength(2);
  });

  it("does not create review actions for ignored or cancelled items without other warnings", () => {
    const actions = buildRecurringActionItems("user-id", [
      item({ id: "r5", status: "ignored" }),
      item({ id: "r6", status: "cancelled" }),
    ]);

    expect(actions).toEqual([]);
  });
});
