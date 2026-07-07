import { describe, expect, it } from "vitest";
import { redactForAi } from "@/lib/ai/redaction";

describe("redactForAi", () => {
  it("removes full account-like numbers but preserves useful transaction facts", () => {
    const result = redactForAi({
      accountName: "Chase Business Checking 123456789012",
      description: "AMAZON Mktp US*AB12",
      amount: 42.18,
      date: "2026-06-01",
      internalUserId: "9f1b3082-1111-4222-9222-7d14754d9abc",
    });

    expect(JSON.stringify(result.redacted)).not.toContain("123456789012");
    expect(JSON.stringify(result.redacted)).not.toContain("9f1b3082");
    expect(JSON.stringify(result.redacted)).toContain("AMAZON");
    expect(JSON.stringify(result.redacted)).toContain("42.18");
    expect(result.summary.removedLongDigitRuns).toBeGreaterThan(0);
  });
});
