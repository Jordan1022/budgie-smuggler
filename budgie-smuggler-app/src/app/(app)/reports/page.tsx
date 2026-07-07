import { requireUser } from "@/lib/auth";
import { formatCurrency, formatPercent } from "@/lib/format";
import { getReportsData } from "@/lib/reports/service";

export default async function ReportsPage() {
  const user = await requireUser();
  const data = await getReportsData(user.id);
  const negative = data.household.net < 0;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-sm text-neutral-600">The whole picture: household cash, business vs personal, debt pressure, and charges to cut.</p>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className={`rounded-2xl border p-4 ${negative ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Household net</p>
          <p className="mt-2 text-2xl font-bold">{formatCurrency(data.household.net)}</p>
          <p className="mt-2 text-sm">{negative ? "Spending is beating income. This is the fire." : "Income is ahead this month."}</p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Debt balance</p>
          <p className="mt-2 text-2xl font-bold">{formatCurrency(data.household.debtBalance)}</p>
          <p className="mt-2 text-sm text-neutral-600">Known debt from entered accounts.</p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Interest drag</p>
          <p className="mt-2 text-2xl font-bold">{formatCurrency(data.household.monthlyInterest)}</p>
          <p className="mt-2 text-sm text-neutral-600">Estimated monthly interest.</p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Recurring spend</p>
          <p className="mt-2 text-2xl font-bold">{formatCurrency(data.household.recurringMonthly)}</p>
          <p className="mt-2 text-sm text-neutral-600">Suspected plus confirmed monthly estimate.</p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
          <h2 className="text-lg font-semibold">Personal vs business</h2>
          <div className="mt-4 divide-y divide-[var(--line)]">
            {data.usageRows.map((row) => (
              <div key={row.usageType} className="grid grid-cols-4 gap-2 py-3 text-sm">
                <p className="font-semibold">{row.usageType}</p>
                <p>Income {formatCurrency(row.income)}</p>
                <p>Spend {formatCurrency(row.spending)}</p>
                <p className={row.net < 0 ? "font-semibold text-red-700" : "font-semibold text-emerald-700"}>{formatCurrency(row.net)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
          <h2 className="text-lg font-semibold">Debt warnings</h2>
          <div className="mt-4 divide-y divide-[var(--line)]">
            {data.debtWarnings.length === 0 ? (
              <p className="rounded-xl bg-neutral-50 px-3 py-3 text-sm text-neutral-700">No debt warnings from entered data. If that feels false, the data is incomplete.</p>
            ) : (
              data.debtWarnings.map((debt) => (
                <div key={debt.id} className="py-3 text-sm">
                  <p className="font-semibold">{debt.name}: {formatCurrency(debt.balance)}</p>
                  <p className="text-neutral-600">APR {debt.apr == null ? "missing" : formatPercent(debt.apr)} · utilization {debt.utilization ?? "unknown"}%</p>
                  <p className="mt-1 text-red-700">{debt.pressureReasons.join(". ")}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--line)] bg-white p-4">
        <h2 className="text-lg font-semibold">Subscription cut list</h2>
        <div className="mt-4 divide-y divide-[var(--line)]">
          {data.subscriptionCutList.length === 0 ? (
            <p className="rounded-xl bg-neutral-50 px-3 py-3 text-sm text-neutral-700">No recurring cut candidates yet. Run a recurring scan after transactions are accepted.</p>
          ) : (
            data.subscriptionCutList.map((item) => (
              <div key={item.id} className="grid gap-2 py-3 text-sm md:grid-cols-[1fr_140px_140px_1fr]">
                <p className="font-semibold">{item.merchantName}</p>
                <p>{formatCurrency(item.monthlyEstimate)}/mo</p>
                <p>{item.status} · {item.usageType}</p>
                <p className="text-neutral-600">{item.reason}</p>
              </div>
            ))
          )}
        </div>
        <p className="mt-3 text-xs text-neutral-500">Source: {data.source}</p>
      </section>
    </div>
  );
}
