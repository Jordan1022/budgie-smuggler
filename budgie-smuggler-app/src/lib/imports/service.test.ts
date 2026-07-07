import { describe, expect, it } from "vitest";
import { buildImportActionItems, summarizeImportRows } from "@/lib/imports/service";

describe("import service helpers", () => {
  it("summarizes rows needing review", () => {
    const summary = summarizeImportRows([
      { reviewStatus: "needs_review", duplicateTransactionId: null },
      { reviewStatus: "needs_review", duplicateTransactionId: "txn-1" },
      { reviewStatus: "suggested", duplicateTransactionId: null },
    ]);

    expect(summary).toEqual({ total: 3, needsReview: 2, duplicateCandidates: 1, suggested: 1 });
  });

  it("creates concrete action items for imported rows", () => {
    const items = buildImportActionItems({
      importBatchId: "batch-1",
      totalRows: 12,
      needsReview: 5,
      duplicateCandidates: 2,
    });

    expect(items).toEqual([
      expect.objectContaining({
        type: "review_import",
        title: "Review 5 imported transactions",
        priority: "high",
        relatedEntityType: "import_batch",
        relatedEntityId: "batch-1",
      }),
      expect.objectContaining({
        type: "check_duplicates",
        title: "Check 2 possible duplicate transactions",
        priority: "normal",
      }),
    ]);
  });
});
