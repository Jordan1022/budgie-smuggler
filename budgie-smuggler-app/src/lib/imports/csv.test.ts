import { describe, expect, it } from "vitest";
import { parseCsvTransactions } from "@/lib/imports/csv";

describe("parseCsvTransactions", () => {
  it("parses a signed amount CSV", () => {
    const result = parseCsvTransactions("Date,Description,Amount\n2026-06-01,Kroger,-42.18\n2026-06-02,Payroll,1200.00");

    expect(result.rows).toEqual([
      expect.objectContaining({
        rawDate: "2026-06-01",
        parsedDate: "2026-06-01",
        rawDescription: "Kroger",
        amount: 42.18,
        direction: "debit",
      }),
      expect.objectContaining({
        rawDate: "2026-06-02",
        parsedDate: "2026-06-02",
        rawDescription: "Payroll",
        amount: 1200,
        direction: "credit",
      }),
    ]);
    expect(result.errors).toEqual([]);
  });

  it("parses split debit and credit columns", () => {
    const csv = "Posted Date,Payee,Debit,Credit\n07/01/2026,Netflix,22.99,\n07/02/2026,Client Payment,,500.00";
    const result = parseCsvTransactions(csv);

    expect(result.rows.map((row) => ({ amount: row.amount, direction: row.direction }))).toEqual([
      { amount: 22.99, direction: "debit" },
      { amount: 500, direction: "credit" },
    ]);
  });

  it("keeps quoted commas in descriptions", () => {
    const result = parseCsvTransactions('Date,Description,Amount\n2026-06-01,"Amazon, Marketplace",-19.99');

    expect(result.rows[0].rawDescription).toBe("Amazon, Marketplace");
  });

  it("reports rows that cannot be parsed", () => {
    const result = parseCsvTransactions("Date,Description,Amount\nbad-date,Kroger,-42.18");

    expect(result.rows).toEqual([]);
    expect(result.errors[0]).toContain("Row 2");
  });
});
