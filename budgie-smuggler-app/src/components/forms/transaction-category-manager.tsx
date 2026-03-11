"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/format";

type TransactionItem = {
  id: string;
  postedDate: string;
  merchantName?: string | null;
  description?: string | null;
  amount: number;
  direction: string;
  categoryId?: string | null;
  categoryName: string;
  userOverrideCategory?: boolean;
  rawCategory?: string[];
};

type CategoryItem = {
  id: string;
  name: string;
};

export function TransactionCategoryManager({
  initialTransactions,
  categories,
  source,
}: {
  initialTransactions: TransactionItem[];
  categories: CategoryItem[];
  source: "mock" | "database";
}) {
  const [rows, setRows] = useState(initialTransactions);
  const [busyIds, setBusyIds] = useState<string[]>([]);

  async function updateCategory(transactionId: string, categoryId: string | null, lockCategory: boolean) {
    setBusyIds((current) => [...current, transactionId]);

    try {
      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          categoryId,
          lockCategory,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update category.");
      }

      setRows((current) =>
        current.map((row) => {
          if (row.id !== transactionId) {
            return row;
          }

          const name = categories.find((category) => category.id === categoryId)?.name ?? "Uncategorized";
          return {
            ...row,
            categoryId,
            categoryName: name,
            userOverrideCategory: lockCategory,
          };
        }),
      );
    } finally {
      setBusyIds((current) => current.filter((id) => id !== transactionId));
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Merchant</th>
              <th className="px-3 py-2">Assigned category</th>
              <th className="px-3 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((txn) => {
              const busy = busyIds.includes(txn.id);
              return (
                <tr key={txn.id} className="border-t border-[var(--line)] align-top">
                  <td className="px-3 py-2">{txn.postedDate}</td>
                  <td className="px-3 py-2">
                    <p>{txn.merchantName || txn.description || "Unknown"}</p>
                    {txn.rawCategory?.length ? (
                      <p className="text-xs text-neutral-500">Plaid hint: {txn.rawCategory.join("/")}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="h-9 w-full rounded-lg border border-[var(--line)] bg-white px-2"
                      value={txn.categoryId ?? ""}
                      disabled={busy}
                      onChange={(event) => updateCategory(txn.id, event.target.value || null, true)}
                    >
                      <option value="">Uncategorized</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-neutral-500">{txn.userOverrideCategory ? "Manual override" : "Auto-mapped"}</span>
                      {txn.userOverrideCategory ? (
                        <button
                          className="text-xs font-semibold text-blue-700"
                          type="button"
                          onClick={() => updateCategory(txn.id, txn.categoryId ?? null, false)}
                        >
                          Return to auto
                        </button>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">{formatCurrency(txn.amount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-[var(--line)] px-3 py-2 text-xs text-neutral-500">
        {source === "mock"
          ? "Running in mock mode. Changes are not persisted to a real database."
          : "Auto category mapping is based on Plaid categories and merchant cues. Manual overrides are preserved."}
      </p>
    </section>
  );
}
