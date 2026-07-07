import { normalizeMerchantKey, normalizeSignedAmount, roundToCents, type ImportDirection } from "@/lib/imports/normalize";

export type ParsedCsvTransaction = {
  rawDate: string;
  parsedDate: string;
  rawDescription: string;
  normalizedDescription: string;
  amount: number;
  direction: ImportDirection;
  sourceRow: Record<string, string>;
};

export type CsvParseResult = {
  rows: ParsedCsvTransaction[];
  errors: string[];
};

const DATE_HEADERS = ["date", "posteddate", "postdate", "transactiondate"];
const DESCRIPTION_HEADERS = ["description", "merchant", "name", "payee", "memo"];
const AMOUNT_HEADERS = ["amount"];
const DEBIT_HEADERS = ["debit", "withdrawal", "charge"];
const CREDIT_HEADERS = ["credit", "deposit", "payment"];

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[\s_-]+/g, "");
}

function parseCsvTable(csvText: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const next = csvText[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(field);
      if (row.some((cell) => cell.trim().length > 0)) {
        rows.push(row);
      }
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  row.push(field);
  if (row.some((cell) => cell.trim().length > 0)) {
    rows.push(row);
  }

  return rows;
}

function findHeader(headers: string[], candidates: string[]) {
  return candidates.map((candidate) => headers.indexOf(candidate)).find((index) => index >= 0) ?? -1;
}

function parseDate(value: string) {
  const trimmed = value.trim();
  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);

  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const usMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(trimmed);
  if (usMatch) {
    const [, month, day, rawYear] = usMatch;
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  throw new Error("Date is not recognized.");
}

function parseSplitAmount(debitValue: string | undefined, creditValue: string | undefined) {
  const debit = debitValue?.trim();
  const credit = creditValue?.trim();

  if (debit) {
    return {
      amount: roundToCents(Math.abs(normalizeSignedAmount(debit).amount)),
      direction: "debit" as const,
    };
  }

  if (credit) {
    return {
      amount: roundToCents(Math.abs(normalizeSignedAmount(credit).amount)),
      direction: "credit" as const,
    };
  }

  throw new Error("Amount is missing.");
}

export function parseCsvTransactions(csvText: string): CsvParseResult {
  const table = parseCsvTable(csvText);
  const errors: string[] = [];

  if (table.length < 2) {
    return { rows: [], errors: ["CSV must contain a header row and at least one transaction row."] };
  }

  const rawHeaders = table[0];
  const headers = rawHeaders.map(normalizeHeader);
  const dateIndex = findHeader(headers, DATE_HEADERS);
  const descriptionIndex = findHeader(headers, DESCRIPTION_HEADERS);
  const amountIndex = findHeader(headers, AMOUNT_HEADERS);
  const debitIndex = findHeader(headers, DEBIT_HEADERS);
  const creditIndex = findHeader(headers, CREDIT_HEADERS);

  if (dateIndex < 0 || descriptionIndex < 0 || (amountIndex < 0 && debitIndex < 0 && creditIndex < 0)) {
    return {
      rows: [],
      errors: ["CSV must include date, description, and amount or debit/credit columns."],
    };
  }

  const rows: ParsedCsvTransaction[] = [];

  table.slice(1).forEach((cells, rowOffset) => {
    const rowNumber = rowOffset + 2;
    const sourceRow = Object.fromEntries(rawHeaders.map((header, index) => [header.trim(), cells[index]?.trim() ?? ""]));

    try {
      const rawDate = cells[dateIndex]?.trim() ?? "";
      const rawDescription = cells[descriptionIndex]?.trim() ?? "";
      if (!rawDescription) {
        throw new Error("Description is missing.");
      }

      const parsedAmount =
        amountIndex >= 0
          ? normalizeSignedAmount(cells[amountIndex]?.trim() ?? "")
          : parseSplitAmount(cells[debitIndex], cells[creditIndex]);

      rows.push({
        rawDate,
        parsedDate: parseDate(rawDate),
        rawDescription,
        normalizedDescription: normalizeMerchantKey(rawDescription),
        amount: parsedAmount.amount,
        direction: parsedAmount.direction,
        sourceRow,
      });
    } catch (error) {
      errors.push(`Row ${rowNumber}: ${error instanceof Error ? error.message : "Unable to parse row."}`);
    }
  });

  return { rows, errors };
}
