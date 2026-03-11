import { formatCurrency, formatPercent } from "@/lib/format";
import type { DashboardSummary } from "@/types/domain";

export function SummaryCards({ summary }: { summary: DashboardSummary }) {
  const cards = [
    { label: "Spent", value: formatCurrency(summary.totalSpent) },
    { label: "Budget", value: formatCurrency(summary.totalBudget) },
    { label: "Remaining", value: formatCurrency(summary.totalRemaining) },
    { label: "Usage", value: formatPercent(summary.progress) },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <article key={card.label} className="rounded-2xl border border-[var(--line)] bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-neutral-500">{card.label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight">{card.value}</p>
        </article>
      ))}
    </section>
  );
}
