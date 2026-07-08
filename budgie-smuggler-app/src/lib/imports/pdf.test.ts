import { describe, expect, it } from "vitest";
import { parsePdfStatementText } from "./pdf";

describe("PDF statement text parsing", () => {
  it("parses text lines with date, description, and trailing amount", () => {
    const parsed = parsePdfStatementText(`
      Account Statement
      06/14/2026 NETFLIX.COM 19.99
      06/15/2026 CLIENT PAYMENT -250.00
    `);

    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]).toMatchObject({
      parsedDate: "2026-06-14",
      rawDescription: "NETFLIX.COM",
      amount: 19.99,
      direction: "debit",
    });
    expect(parsed.rows[1]).toMatchObject({
      parsedDate: "2026-06-15",
      rawDescription: "CLIENT PAYMENT",
      amount: 250,
      direction: "credit",
    });
  });

  it("parses ISO dates and currency symbols", () => {
    const parsed = parsePdfStatementText("2026-06-16 Adobe Creative Cloud $59.99");

    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].parsedDate).toBe("2026-06-16");
    expect(parsed.rows[0].normalizedDescription).toBe("adobe creative cloud");
  });

  it("returns an error when no transactions are recognized", () => {
    const parsed = parsePdfStatementText("This PDF has no text transaction rows.");

    expect(parsed.rows).toEqual([]);
    expect(parsed.errors[0]).toContain("No recognizable transaction lines");
  });
});
