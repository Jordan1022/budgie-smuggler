import type { ActionItemInput } from "@/lib/action-items";

export type RecurringActionInput = {
  id: string;
  merchantName: string;
  status: string;
  usageType: string;
  cadence: string;
  typicalAmount: number;
  priceIncreaseDetected: boolean;
  increaseAmount: number | null;
};

function baseAction(item: RecurringActionInput): Pick<ActionItemInput, "relatedEntityType" | "relatedEntityId" | "source"> {
  return {
    relatedEntityType: "recurring_item",
    relatedEntityId: item.id,
    source: "rule",
  };
}

export function buildRecurringActionItems(_userId: string, items: RecurringActionInput[]): ActionItemInput[] {
  const actions: ActionItemInput[] = [];

  for (const item of items) {
    if (item.status === "suspected") {
      actions.push({
        ...baseAction(item),
        type: "review_suspected_recurring",
        title: `${item.merchantName}: confirm recurring ${item.cadence} charge`,
        body: "Suspected recurring charge. Confirm it or kill the noise.",
        priority: "normal",
      });
    }

    if (item.priceIncreaseDetected) {
      actions.push({
        ...baseAction(item),
        type: "review_price_increase",
        title: `${item.merchantName}: price increased`,
        body: item.increaseAmount
          ? `Price increased by about $${item.increaseAmount.toFixed(2)}. Decide if it still earns its place.`
          : "Price increased. Decide if it still earns its place.",
        priority: "high",
      });
    }

    if (item.usageType === "mixed" || item.usageType === "unknown") {
      actions.push({
        ...baseAction(item),
        type: "review_cross_usage_recurring",
        title: `${item.merchantName}: classify personal vs business`,
        body: "Usage unknown. Personal vs business matters here.",
        priority: "normal",
      });
    }
  }

  return actions;
}
