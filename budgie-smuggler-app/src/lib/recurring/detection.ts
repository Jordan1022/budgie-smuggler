import { addDays, differenceInCalendarDays, startOfDay } from "date-fns";

export type RecurringCadence = "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly" | "unknown";

export type RecurringDetectionTransaction = {
  id: string;
  postedDate: Date | string;
  merchantName: string | null;
  description: string | null;
  amount: number;
  direction: string;
  usageType: string;
  categoryId?: string | null;
};

export type DetectedRecurringItem = {
  merchantName: string;
  normalizedMerchantKey: string;
  usageType: string;
  categoryId: string | null;
  amountMin: number;
  amountMax: number;
  typicalAmount: number;
  cadence: RecurringCadence;
  nextExpectedDate: Date | null;
  lastSeenDate: Date;
  transactionCount: number;
  status: "suspected";
  priceIncreaseDetected: boolean;
  increaseAmount: number | null;
  transactionIds: string[];
};

const CADENCE_WINDOWS: Array<{ cadence: Exclude<RecurringCadence, "unknown">; min: number; max: number; nextDays: number }> = [
  { cadence: "weekly", min: 6, max: 8, nextDays: 7 },
  { cadence: "biweekly", min: 13, max: 15, nextDays: 14 },
  { cadence: "monthly", min: 27, max: 35, nextDays: 30 },
  { cadence: "quarterly", min: 80, max: 100, nextDays: 90 },
  { cadence: "yearly", min: 350, max: 380, nextDays: 365 },
];

function parseDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00`);
  return startOfDay(date);
}

function roundCents(value: number) {
  return Math.round(value * 100) / 100;
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function pickCadence(dayGaps: number[]): { cadence: RecurringCadence; nextDays: number | null } {
  if (dayGaps.length === 0) {
    return { cadence: "unknown", nextDays: null };
  }

  const matchingWindow = CADENCE_WINDOWS.find((window) => dayGaps.every((gap) => gap >= window.min && gap <= window.max));
  return matchingWindow ? { cadence: matchingWindow.cadence, nextDays: matchingWindow.nextDays } : { cadence: "unknown", nextDays: null };
}

function pickUsageType(values: string[]) {
  const unique = Array.from(new Set(values.filter(Boolean)));
  return unique.length === 1 ? unique[0] : "mixed";
}

function pickCategoryId(values: Array<string | null | undefined>) {
  const unique = Array.from(new Set(values.filter(Boolean)));
  return unique.length === 1 ? unique[0] ?? null : null;
}

function priceIncrease(amounts: number[]) {
  if (amounts.length < 3) {
    return { priceIncreaseDetected: false, increaseAmount: null };
  }

  const latest = amounts[amounts.length - 1];
  const priorTypical = average(amounts.slice(0, -1));
  const increaseAmount = roundCents(latest - priorTypical);

  if (increaseAmount >= 2 && latest >= priorTypical * 1.1) {
    return { priceIncreaseDetected: true, increaseAmount };
  }

  return { priceIncreaseDetected: false, increaseAmount: null };
}

export function normalizeMerchantKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\b(co|inc|llc|ltd|payment|purchase|pos|debit|card)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectRecurringItems(transactions: RecurringDetectionTransaction[]): DetectedRecurringItem[] {
  const groups = new Map<string, RecurringDetectionTransaction[]>();

  for (const transaction of transactions) {
    if (transaction.direction !== "debit") {
      continue;
    }

    const merchant = transaction.merchantName || transaction.description;
    if (!merchant) {
      continue;
    }

    const key = normalizeMerchantKey(merchant);
    if (!key) {
      continue;
    }

    groups.set(key, [...(groups.get(key) ?? []), transaction]);
  }

  const items: DetectedRecurringItem[] = [];

  for (const [normalizedMerchantKey, groupedTransactions] of groups) {
    if (groupedTransactions.length < 2) {
      continue;
    }

    const sorted = [...groupedTransactions].sort((left, right) => parseDate(left.postedDate).getTime() - parseDate(right.postedDate).getTime());
    const amounts = sorted.map((transaction) => Math.abs(transaction.amount));
    const amountMin = Math.min(...amounts);
    const amountMax = Math.max(...amounts);
    const typicalAmount = roundCents(average(amounts));
    const allowedVariance = Math.max(5, typicalAmount * 0.15);

    if (amountMax - amountMin > allowedVariance) {
      continue;
    }

    const dates = sorted.map((transaction) => parseDate(transaction.postedDate));
    const gaps = dates.slice(1).map((date, index) => differenceInCalendarDays(date, dates[index]));
    const { cadence, nextDays } = pickCadence(gaps);
    const lastSeenDate = dates[dates.length - 1];
    const increase = priceIncrease(amounts);

    items.push({
      merchantName: sorted[sorted.length - 1].merchantName || sorted[sorted.length - 1].description || normalizedMerchantKey,
      normalizedMerchantKey,
      usageType: pickUsageType(sorted.map((transaction) => transaction.usageType)),
      categoryId: pickCategoryId(sorted.map((transaction) => transaction.categoryId)),
      amountMin: roundCents(amountMin),
      amountMax: roundCents(amountMax),
      typicalAmount,
      cadence,
      nextExpectedDate: nextDays ? addDays(lastSeenDate, nextDays) : null,
      lastSeenDate,
      transactionCount: sorted.length,
      status: "suspected",
      priceIncreaseDetected: increase.priceIncreaseDetected,
      increaseAmount: increase.increaseAmount,
      transactionIds: sorted.map((transaction) => transaction.id),
    });
  }

  return items.sort((left, right) => left.merchantName.localeCompare(right.merchantName));
}
