export function buildThresholdDedupeKey({
  budgetId,
  month,
  threshold,
}: {
  budgetId: string;
  month: string;
  threshold: number;
}) {
  return `threshold:${budgetId}:${month}:${threshold}`;
}

export function buildOverspendDedupeKey({ budgetId, month }: { budgetId: string; month: string }) {
  return `overspend:${budgetId}:${month}`;
}

export function evaluateTriggeredThresholds(percentUsed: number, configured: number[]) {
  return [...new Set(configured)].sort((a, b) => a - b).filter((threshold) => percentUsed >= threshold);
}

export function shouldTriggerUnusualSpend({
  current,
  trailingAverage,
  multiplier,
}: {
  current: number;
  trailingAverage: number;
  multiplier: number;
}) {
  if (trailingAverage <= 0 || multiplier <= 1) {
    return false;
  }

  return current >= trailingAverage * multiplier;
}
