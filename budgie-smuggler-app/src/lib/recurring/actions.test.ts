import { afterEach, describe, expect, it, vi } from "vitest";
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

  it("skips all actions for ignored or cancelled items", () => {
    const actions = buildRecurringActionItems("user-id", [
      item({ id: "r7", status: "ignored", usageType: "unknown", priceIncreaseDetected: true, increaseAmount: 4 }),
      item({ id: "r8", status: "cancelled", usageType: "mixed", priceIncreaseDetected: true, increaseAmount: 7 }),
    ]);

    expect(actions).toEqual([]);
  });
});

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.unmock("@/lib/prisma");
  vi.unmock("@/lib/action-items");
  vi.unmock("./detection");
});

describe("recurring scan service", () => {
  it("fetches the newest debit transactions and detects against chronological input", async () => {
    const newest = {
      id: "newest",
      postedDate: new Date("2024-03-01"),
      merchantName: "Netflix",
      description: "Netflix",
      amount: 19.99,
      direction: "debit",
      usageType: "personal",
      categoryId: null,
    };
    const oldest = {
      id: "oldest",
      postedDate: new Date("2024-01-01"),
      merchantName: "Netflix",
      description: "Netflix",
      amount: 19.99,
      direction: "debit",
      usageType: "personal",
      categoryId: null,
    };
    let detectedTransactionIds: string[] = [];
    const detectRecurringItems = vi.fn((transactions: Array<{ id: string }>) => {
      detectedTransactionIds = transactions.map((transaction) => transaction.id);
      return [];
    });
    const createActionItems = vi.fn();
    const mockPrisma = {
      transaction: {
        findMany: vi.fn().mockResolvedValue([newest, oldest]),
      },
      recurringItem: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      $transaction: vi.fn(async (callback) =>
        callback({
          recurringItem: {
            findMany: vi.fn().mockResolvedValue([]),
            upsert: vi.fn(),
          },
          recurringTransactionLink: {
            createMany: vi.fn(),
          },
        }),
      ),
    };

    vi.doMock("@/lib/prisma", () => ({ prisma: mockPrisma }));
    vi.doMock("@/lib/action-items", () => ({ createActionItems }));
    vi.doMock("./detection", () => ({ detectRecurringItems }));
    const { scanRecurringItems } = await import("./service");

    await scanRecurringItems("user-id");

    expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith({
      where: {
        ownerUserId: "user-id",
        direction: "debit",
        reviewStatus: "accepted",
      },
      orderBy: { postedDate: "desc" },
      take: 1500,
    });
    expect(detectedTransactionIds).toEqual(["oldest", "newest"]);
  });

  it("wraps recurring upserts and link creation in one transaction before refreshing actions", async () => {
    const events: string[] = [];
    const detectedItem = {
      merchantName: "Netflix",
      normalizedMerchantKey: "netflix",
      usageType: "personal",
      categoryId: null,
      amountMin: 19.99,
      amountMax: 19.99,
      typicalAmount: 19.99,
      cadence: "monthly",
      nextExpectedDate: new Date("2024-04-01"),
      lastSeenDate: new Date("2024-03-01"),
      transactionCount: 2,
      status: "suspected",
      priceIncreaseDetected: false,
      increaseAmount: null,
      transactionIds: ["t1", "t2"],
    };
    const tx = {
      recurringItem: {
        findMany: vi.fn().mockResolvedValue([]),
        upsert: vi.fn().mockResolvedValue({ id: "recurring-1" }),
      },
      recurringTransactionLink: {
        createMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
    };
    const mockPrisma = {
      transaction: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "t1",
            postedDate: new Date("2024-01-01"),
            merchantName: "Netflix",
            description: "Netflix",
            amount: 19.99,
            direction: "debit",
            usageType: "personal",
            categoryId: null,
          },
        ]),
      },
      recurringItem: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      $transaction: vi.fn(async (callback) => {
        const result = await callback(tx);
        events.push("transaction");
        return result;
      }),
    };
    const createActionItems = vi.fn(async () => {
      events.push("refresh");
      return { created: 0, source: "database" as const };
    });

    vi.doMock("@/lib/prisma", () => ({ prisma: mockPrisma }));
    vi.doMock("@/lib/action-items", () => ({ createActionItems }));
    vi.doMock("./detection", () => ({ detectRecurringItems: vi.fn(() => [detectedItem]) }));
    const { scanRecurringItems } = await import("./service");

    await scanRecurringItems("user-id");

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.recurringItem.upsert).toHaveBeenCalledTimes(1);
    expect(tx.recurringTransactionLink.createMany).toHaveBeenCalledTimes(1);
    expect(events).toEqual(["transaction", "refresh"]);
  });
});
