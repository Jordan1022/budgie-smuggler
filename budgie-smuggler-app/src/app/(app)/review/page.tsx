import { ImportReviewTable } from "@/components/review/import-review-table";
import { requireUser } from "@/lib/auth";
import { getImportedTransactionsForReview } from "@/lib/server-data";

export default async function ReviewPage() {
  const user = await requireUser();
  const data = await getImportedTransactionsForReview(user.id);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Review</h1>
        <p className="text-sm text-neutral-600">Confirm imported transactions before they become reliable ledger data.</p>
      </header>

      <ImportReviewTable initialTransactions={data.transactions} source={data.source} />
    </div>
  );
}
