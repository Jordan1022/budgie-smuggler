import { DataSourceBanner } from "@/components/dashboard/data-source-banner";
import { BudgetList } from "@/components/dashboard/budget-list";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { requireUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/server-data";

export default async function DashboardPage() {
  const user = await requireUser();
  const { summary, progress, source } = await getDashboardData(user.id);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-neutral-600">Track your monthly progress at a glance.</p>
      </header>

      <DataSourceBanner source={source} />
      <SummaryCards summary={summary} />

      <section className="rounded-2xl border border-[var(--line)] bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">Category budgets</h2>
        <BudgetList items={progress} />
      </section>
    </div>
  );
}
