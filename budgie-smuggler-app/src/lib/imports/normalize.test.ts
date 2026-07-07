import { describe, expect, it } from "vitest";
import { buildDuplicateFingerprint, normalizeMerchantKey, normalizeSignedAmount } from "@/lib/imports/normalize";

describe("import normalization", () => {
  it("normalizes signed amounts", () => {
    expect(normalizeSignedAmount("-42.187")).toEqual({ amount: 42.19, direction: "debit" });
    expect(normalizeSignedAmount("1200")).toEqual({ amount: 1200, direction: "credit" });
  });

  it("builds stable merchant keys", () => {
    expect(normalizeMerchantKey("Amazon Marketplace #123")).toBe("amazon marketplace");
  });

  it("builds duplicate fingerprints from account, date, amount, direction, and merchant", () => {
    expect(
      buildDuplicateFingerprint({
        bankAccountId: "acct-1",
        parsedDate: "2026-06-01",
        amount: 42.18,
        direction: "debit",
        normalizedDescription: "Kroger",
      }),
    ).toBe("acct-1|2026-06-01|debit|42.18|kroger");
  });
});
