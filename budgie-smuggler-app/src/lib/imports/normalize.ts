export type ImportDirection = "debit" | "credit";

export function roundToCents(value: number) {
  return Math.round(value * 100) / 100;
}

function parseMoney(value: string | number) {
  if (typeof value === "number") {
    return value;
  }

  const trimmed = value.trim();
  const isParentheticalNegative = /^\(.*\)$/.test(trimmed);
  const normalized = trimmed.replace(/[($,\s)]/g, "");
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    throw new Error("Amount is not a number.");
  }

  return isParentheticalNegative ? -parsed : parsed;
}

export function normalizeSignedAmount(input: string | number): { amount: number; direction: ImportDirection } {
  const value = parseMoney(input);

  return {
    amount: roundToCents(Math.abs(value)),
    direction: value < 0 ? "debit" : "credit",
  };
}

export function normalizeMerchantKey(input: string) {
  return input
    .toLowerCase()
    .replace(/[#*][a-z0-9-]+/gi, " ")
    .replace(/\b\d{2,}\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function buildDuplicateFingerprint(input: {
  bankAccountId: string;
  parsedDate: string;
  amount: number;
  direction: string;
  normalizedDescription: string;
}) {
  return [
    input.bankAccountId,
    input.parsedDate,
    input.direction,
    input.amount.toFixed(2),
    normalizeMerchantKey(input.normalizedDescription),
  ].join("|");
}
