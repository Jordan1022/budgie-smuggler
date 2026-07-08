import { addDays } from "date-fns";
import { describe, expect, it } from "vitest";
import { detectRecurringItems, normalizeMerchantKey, type RecurringDetectionTransaction } from "./detection";

function transaction(overrides: Partial<RecurringDetectionTransaction>): RecurringDetectionTransaction {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    postedDate: overrides.postedDate ?? "2026-01-01",
    merchantName: overrides.merchantName ?? "Netflix",
    description: overrides.description ?? overrides.merchantName ?? "Netflix",
    amount: overrides.amount ?? 19.99,
    direction: overrides.direction ?? "debit",
    usageType: overrides.usageType ?? "personal",
    categoryId: overrides.categoryId ?? null,
  };
}

describe("recurring detection", () => {
  it("normalizes merchant keys", () => {
    expect(normalizeMerchantKey("NETFLIX.COM 866-579-7172")).toBe("netflix com");
  });

  it("detects monthly recurring charges", () => {
    const items = detectRecurringItems([
      transaction({ id: "n1", postedDate: "2026-01-01", merchantName: "Netflix", amount: 19.99 }),
      transaction({ id: "n2", postedDate: "2026-01-31", merchantName: "Netflix", amount: 19.99 }),
      transaction({ id: "n3", postedDate: "2026-03-02", merchantName: "Netflix", amount: 19.99 }),
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      merchantName: "Netflix",
      normalizedMerchantKey: "netflix",
      cadence: "monthly",
      typicalAmount: 19.99,
      transactionCount: 3,
      status: "suspected",
      priceIncreaseDetected: false,
      transactionIds: ["n1", "n2", "n3"],
    });
    expect(items[0].nextExpectedDate?.toISOString().slice(0, 10)).toBe("2026-04-01");
  });

  it("detects weekly recurring charges", () => {
    const start = new Date("2026-01-06T00:00:00");
    const items = detectRecurringItems(
      [0, 7, 14, 21].map((offset, index) =>
        transaction({
          id: `w${index}`,
          postedDate: addDays(start, offset),
          merchantName: "GitHub",
          amount: 48,
          usageType: "business",
        }),
      ),
    );

    expect(items).toHaveLength(1);
    expect(items[0].cadence).toBe("weekly");
    expect(items[0].usageType).toBe("business");
  });

  it("flags price increases when latest amount jumps enough", () => {
    const items = detectRecurringItems([
      transaction({ id: "s1", postedDate: "2026-01-01", merchantName: "SaaS Tool", amount: 20 }),
      transaction({ id: "s2", postedDate: "2026-02-01", merchantName: "SaaS Tool", amount: 20 }),
      transaction({ id: "s3", postedDate: "2026-03-01", merchantName: "SaaS Tool", amount: 25 }),
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].priceIncreaseDetected).toBe(true);
    expect(items[0].increaseAmount).toBe(5);
  });

  it("ignores one-off charges", () => {
    expect(detectRecurringItems([transaction({ id: "o1", merchantName: "Random Store" })])).toEqual([]);
  });

  it("ignores credits", () => {
    const items = detectRecurringItems([
      transaction({ id: "c1", postedDate: "2026-01-01", merchantName: "Payroll", direction: "credit", amount: 1000 }),
      transaction({ id: "c2", postedDate: "2026-02-01", merchantName: "Payroll", direction: "credit", amount: 1000 }),
    ]);

    expect(items).toEqual([]);
  });

  it("marks usage as mixed when transactions disagree", () => {
    const items = detectRecurringItems([
      transaction({ id: "m1", postedDate: "2026-01-01", merchantName: "Amazon", amount: 10, usageType: "personal" }),
      transaction({ id: "m2", postedDate: "2026-02-01", merchantName: "Amazon", amount: 10, usageType: "business" }),
    ]);

    expect(items[0].usageType).toBe("mixed");
  });
});
