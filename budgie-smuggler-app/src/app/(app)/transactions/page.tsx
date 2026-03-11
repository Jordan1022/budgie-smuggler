import { TransactionCategoryManager } from "@/components/forms/transaction-category-manager";
import { requireUser } from "@/lib/auth";
import { getCategories, getTransactions } from "@/lib/server-data";

export default async function TransactionsPage() {
  const user = await requireUser();
  const [{ transactions, source }, categories] = await Promise.all([getTransactions(user.id), getCategories(user.id)]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
        <p className="text-sm text-neutral-600">Latest activity with category mapping controls. Source: {source}.</p>
      </header>
      <TransactionCategoryManager initialTransactions={transactions} categories={categories} source={source} />
    </div>
  );
}
