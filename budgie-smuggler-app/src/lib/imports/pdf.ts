import { PDFParse } from "pdf-parse";
import { normalizeMerchantKey, roundToCents } from "@/lib/imports/normalize";
import type { CsvParseResult, ParsedCsvTransaction } from "./csv";

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

  throw new Error("Date is not recognized.");
}

function parseAmount(value: string) {
  const parsed = Number(value.replace(/[$,]/g, ""));
  if (!Number.isFinite(parsed)) {
    throw new Error("Amount is not a number.");
  }

  return {
    amount: roundToCents(Math.abs(parsed)),
    direction: parsed < 0 ? ("credit" as const) : ("debit" as const),
  };
}

export function parsePdfStatementText(text: string): CsvParseResult {
  const rows: ParsedCsvTransaction[] = [];
  const errors: string[] = [];
  const linePattern = /^\s*(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\/\d{1,2}\/(?:\d{2}|\d{4}))\s+(.+?)\s+(-?\$?[\d,]+(?:\.\d{2})?)\s*$/;

  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line, index) => {
      const match = linePattern.exec(line);
      if (!match) {
        return;
      }

      try {
        const [, rawDate, rawDescription, rawAmount] = match;
        const amount = parseAmount(rawAmount);
        rows.push({
          rawDate,
          parsedDate: parseDate(rawDate),
          rawDescription,
          normalizedDescription: normalizeMerchantKey(rawDescription),
          amount: amount.amount,
          direction: amount.direction,
          sourceRow: {
            lineNumber: String(index + 1),
            line,
          },
        });
      } catch (error) {
        errors.push(`Line ${index + 1}: ${error instanceof Error ? error.message : "Unable to parse line."}`);
      }
    });

  if (rows.length === 0 && errors.length === 0) {
    errors.push("No recognizable transaction lines found. Scanned PDFs need OCR before import.");
  }

  return { rows, errors };
}

export async function extractPdfText(buffer: Buffer) {
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}
