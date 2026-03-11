import { clsx } from "clsx";
import { formatCurrency } from "@/lib/format";
import type { BudgetProgress } from "@/types/domain";

export function BudgetList({ items }: { items: BudgetProgress[] }) {
  if (!items.length) {
    return <p className="text-sm text-neutral-600">No budget categories yet.</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const tone = item.percentUsed >= 100 ? "danger" : item.percentUsed >= 80 ? "warn" : "ok";
        return (
          <article key={item.budgetId} className="rounded-xl border border-[var(--line)] bg-white p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">{item.categoryName}</p>
              <p className="text-xs text-neutral-500">
                {formatCurrency(item.spent)} / {formatCurrency(item.limit)}
              </p>
            </div>
            <div className="h-2 overflow-hidden rounded bg-neutral-100">
              <div
                className={clsx("h-full rounded", {
                  "bg-emerald-500": tone === "ok",
                  "bg-amber-500": tone === "warn",
                  "bg-red-500": tone === "danger",
                })}
                style={{ width: `${Math.min(item.percentUsed, 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-neutral-500">Remaining: {formatCurrency(item.remaining)}</p>
          </article>
        );
      })}
    </div>
  );
}
