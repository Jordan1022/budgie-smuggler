import { BudgetEditor } from "@/components/forms/budget-editor";
import { requireUser } from "@/lib/auth";
import { getBudgets, getCategories } from "@/lib/server-data";

export default async function BudgetsPage() {
  const user = await requireUser();
  const [{ budgets, source }, categories] = await Promise.all([getBudgets(user.id), getCategories(user.id)]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Budgets</h1>
        <p className="text-sm text-neutral-600">Assign custom categories and monthly limits. Source: {source}.</p>
      </header>
      <BudgetEditor initialBudgets={budgets} initialCategories={categories} source={source} />
    </div>
  );
}
