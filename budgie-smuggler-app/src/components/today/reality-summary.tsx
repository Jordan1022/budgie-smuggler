import { formatCurrency } from "@/lib/format";

type Reality = {
  cashFlow: number;
  spending: number;
  income: number;
  needsReview: number;
  missingDebtDetails: number;
};

export function RealitySummary({ reality, source }: { reality: Reality; source: "mock" | "database" }) {
  const isNegative = reality.cashFlow < 0;

  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <div className={`rounded-2xl border p-4 ${isNegative ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}>
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Cash flow</p>
        <p className="mt-2 text-2xl font-bold">{formatCurrency(reality.cashFlow)}</p>
        <p className="mt-2 text-sm">{isNegative ? "You are cash-flow negative this month." : "You are above water this month. Keep it that way."}</p>
      </div>

      <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Income</p>
        <p className="mt-2 text-2xl font-bold">{formatCurrency(reality.income)}</p>
        <p className="mt-2 text-sm text-neutral-600">Accepted income this month.</p>
      </div>

      <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Spending</p>
        <p className="mt-2 text-2xl font-bold">{formatCurrency(reality.spending)}</p>
        <p className="mt-2 text-sm text-neutral-600">Accepted spending this month.</p>
      </div>

      <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Reliability</p>
        <p className="mt-2 text-2xl font-bold">{reality.needsReview}</p>
        <p className="mt-2 text-sm text-neutral-600">
          {reality.needsReview} imported transactions are not reliable yet. Source: {source}.
        </p>
      </div>

      {reality.missingDebtDetails > 0 ? (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 md:col-span-2 xl:col-span-4">
          <p className="font-semibold">{reality.missingDebtDetails} debt accounts are missing APR, minimum payment, or due date details. Fill them in or the plan is guesswork.</p>
        </div>
      ) : null}
    </section>
  );
}
