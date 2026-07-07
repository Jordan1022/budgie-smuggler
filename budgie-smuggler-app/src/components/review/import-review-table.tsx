"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/format";

type ImportedTransactionItem = {
  id: string;
  parsedDate: string;
  rawDescription: string;
  amount: number;
  direction: string;
  detectedCategory?: string | null;
  detectedUsageType: string;
  detectedCashFlowRole: string;
  reviewStatus: string;
  duplicateTransactionId?: string | null;
  confidence?: number | null;
  accountName: string;
};

type ClassificationSuggestion = {
  importedTransactionId: string;
  suggestedCategory: string | null;
  usageType: string;
  cashFlowRole: string;
  confidence: number;
};

const usageOptions = ["personal", "business", "mixed", "unknown"];
const roleOptions = ["spending", "income", "transfer", "debt_payment", "interest", "fee", "refund", "other"];

export function ImportReviewTable({
  initialTransactions,
  source,
}: {
  initialTransactions: ImportedTransactionItem[];
  source: "mock" | "database";
}) {
  const [rows, setRows] = useState(initialTransactions);
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  function setBusy(id: string, busy: boolean) {
    setBusyIds((current) => (busy ? [...current, id] : current.filter((busyId) => busyId !== id)));
  }

  async function updateRow(id: string, data: Partial<ImportedTransactionItem>) {
    setBusy(id, true);
    setMessage(null);

    try {
      const response = await fetch(`/api/imported-transactions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Could not update imported transaction.");
      }

      if (data.reviewStatus === "ignored") {
        setRows((current) => current.filter((row) => row.id !== id));
      } else {
        setRows((current) => current.map((row) => (row.id === id ? { ...row, ...data } : row)));
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Update failed.");
    } finally {
      setBusy(id, false);
    }
  }

  async function acceptRow(row: ImportedTransactionItem) {
    setBusy(row.id, true);
    setMessage(null);

    try {
      const response = await fetch(`/api/imported-transactions/${row.id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acceptDuplicate: Boolean(row.duplicateTransactionId) }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Could not accept imported transaction.");
      }

      setRows((current) => current.filter((item) => item.id !== row.id));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Accept failed.");
    } finally {
      setBusy(row.id, false);
    }
  }

  async function classifyRows() {
    if (rows.length === 0) {
      return;
    }

    setBusyIds(rows.map((row) => row.id));
    setMessage(null);

    try {
      const response = await fetch("/api/ai/import-classifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importedTransactionIds: rows.map((row) => row.id) }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Classification failed.");
      }

      const returnedSuggestions = payload.classification.transactions as ClassificationSuggestion[];
      const suggestions = new Map<string, ClassificationSuggestion>(
        returnedSuggestions.map((suggestion) => [suggestion.importedTransactionId, suggestion]),
      );

      setRows((current) =>
        current.map((row) => {
          const suggestion = suggestions.get(row.id);
          if (!suggestion) {
            return row;
          }

          return {
            ...row,
            detectedCategory: suggestion.suggestedCategory,
            detectedUsageType: suggestion.usageType,
            detectedCashFlowRole: suggestion.cashFlowRole,
            confidence: suggestion.confidence,
            reviewStatus: suggestion.confidence >= 0.7 ? "suggested" : "needs_review",
          };
        }),
      );
      setMessage(payload.source === "fallback" ? "Grok is not configured. Fallback suggestions were applied." : "Grok suggestions were applied.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Classification failed.");
    } finally {
      setBusyIds([]);
    }
  }

  if (rows.length === 0) {
    return (
      <section className="rounded-2xl border border-[var(--line)] bg-white p-4">
        <h2 className="text-lg font-semibold">Nothing waiting for review</h2>
        <p className="mt-1 text-sm text-neutral-600">Import a CSV statement to build the queue.</p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
      <div className="border-b border-[var(--line)] px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Imported transactions</h2>
            <p className="text-sm text-neutral-600">
              Confirm each row before it counts as reliable ledger data. Source: {source}.
            </p>
          </div>
          <button
            className="h-9 rounded-lg border border-[var(--line)] px-3 text-xs font-semibold text-neutral-700 disabled:opacity-50"
            disabled={busyIds.length > 0 || rows.length === 0}
            type="button"
            onClick={classifyRows}
          >
            Classify with Grok
          </button>
        </div>
        {message ? <p className="mt-2 text-sm font-semibold text-neutral-700">{message}</p> : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Account</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Use</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const busy = busyIds.includes(row.id);
              return (
                <tr key={row.id} className="border-t border-[var(--line)] align-top">
                  <td className="px-3 py-3">{row.parsedDate}</td>
                  <td className="px-3 py-3">{row.accountName}</td>
                  <td className="px-3 py-3">
                    <p className="font-medium">{row.rawDescription}</p>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs">
                      {row.duplicateTransactionId ? (
                        <span className="rounded-full bg-red-50 px-2 py-1 font-semibold text-red-700">Possible duplicate</span>
                      ) : null}
                      {row.detectedCategory ? <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">{row.detectedCategory}</span> : null}
                      {row.confidence ? <span className="rounded-full bg-neutral-100 px-2 py-1 text-neutral-600">{Math.round(row.confidence * 100)}%</span> : null}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      className="h-9 w-full rounded-lg border border-[var(--line)] bg-white px-2"
                      disabled={busy}
                      value={row.detectedUsageType}
                      onChange={(event) => updateRow(row.id, { detectedUsageType: event.target.value })}
                    >
                      {usageOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      className="h-9 w-full rounded-lg border border-[var(--line)] bg-white px-2"
                      disabled={busy}
                      value={row.detectedCashFlowRole}
                      onChange={(event) => updateRow(row.id, { detectedCashFlowRole: event.target.value })}
                    >
                      {roleOptions.map((option) => (
                        <option key={option} value={option}>
                          {option.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <p>{formatCurrency(row.amount)}</p>
                    <p className="text-xs text-neutral-500">{row.direction}</p>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        className="h-9 rounded-lg border border-[var(--line)] px-3 text-xs font-semibold text-neutral-700 disabled:opacity-50"
                        disabled={busy}
                        type="button"
                        onClick={() => updateRow(row.id, { reviewStatus: "ignored" })}
                      >
                        Ignore
                      </button>
                      <button
                        className="h-9 rounded-lg bg-[var(--accent)] px-3 text-xs font-semibold text-[var(--ink)] disabled:opacity-50"
                        disabled={busy}
                        type="button"
                        onClick={() => acceptRow(row)}
                      >
                        Accept
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
