"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import type { RecurringItemView } from "@/lib/recurring/service";

const statusStyles: Record<string, string> = {
  suspected: "bg-orange-50 text-orange-700",
  confirmed: "bg-emerald-50 text-emerald-700",
  ignored: "bg-neutral-100 text-neutral-600",
  cancelled: "bg-red-50 text-red-700",
};

export function RecurringConsole({
  initialItems,
  source,
}: {
  initialItems: RecurringItemView[];
  source: "mock" | "database";
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const summary = useMemo(() => {
    const activeItems = items.filter((item) => item.status === "suspected" || item.status === "confirmed");
    return {
      suspected: items.filter((item) => item.status === "suspected").length,
      confirmed: items.filter((item) => item.status === "confirmed").length,
      muted: items.filter((item) => item.status === "ignored" || item.status === "cancelled").length,
      monthlyEstimate: activeItems.reduce((sum, item) => {
        const multiplier = item.cadence === "weekly" ? 4.33 : item.cadence === "biweekly" ? 2.17 : item.cadence === "quarterly" ? 0.33 : item.cadence === "yearly" ? 0.083 : 1;
        return sum + item.typicalAmount * multiplier;
      }, 0),
    };
  }, [items]);

  async function scan() {
    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch("/api/recurring-items/scan", { method: "POST" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Recurring scan failed.");
      }

      const refreshed = await fetch("/api/recurring-items", { cache: "no-store" });
      const refreshedPayload = await refreshed.json().catch(() => null);
      if (refreshed.ok && Array.isArray(refreshedPayload?.items)) {
        setItems(refreshedPayload.items);
      }

      setMessage(`Scanned ${payload.scanned} transactions and detected ${payload.detected} recurring groups.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Recurring scan failed.");
    } finally {
      setBusy(false);
    }
  }

  async function updateItem(id: string, data: { status?: string; usageType?: string }) {
    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/recurring-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const errorMessage = typeof payload?.error === "string" ? payload.error : payload?.error ? JSON.stringify(payload.error) : "Could not update recurring item.";
        throw new Error(errorMessage);
      }

      setItems((current) => current.map((item) => (item.id === id ? payload.item : item)));
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update recurring item.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Suspected</p>
          <p className="mt-2 text-2xl font-bold">{summary.suspected}</p>
          <p className="mt-2 text-sm">Confirm it or ignore it. Do not leave mystery charges vague.</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Confirmed</p>
          <p className="mt-2 text-2xl font-bold">{summary.confirmed}</p>
          <p className="mt-2 text-sm">Recurring charges you have acknowledged.</p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Muted</p>
          <p className="mt-2 text-2xl font-bold">{summary.muted}</p>
          <p className="mt-2 text-sm text-neutral-600">Ignored or cancelled rows.</p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Monthly estimate</p>
          <p className="mt-2 text-2xl font-bold">{formatCurrency(summary.monthlyEstimate)}</p>
          <p className="mt-2 text-sm text-neutral-600">Suspected plus confirmed recurring spend.</p>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--line)] bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Recurring charges</h2>
            <p className="text-sm text-neutral-600">Source: {source}</p>
          </div>
          <Button type="button" disabled={busy} onClick={() => void scan()}>
            {busy ? "Scanning..." : "Scan accepted transactions"}
          </Button>
        </div>

        {message ? <p className="mt-3 text-sm font-semibold text-neutral-700">{message}</p> : null}

        <div className="mt-4 divide-y divide-[var(--line)]">
          {items.length === 0 ? (
            <p className="rounded-xl bg-neutral-50 px-3 py-3 text-sm text-neutral-700">No recurring items yet. Run a scan after accepting imported transactions.</p>
          ) : (
            items.map((item) => (
              <article key={item.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{item.merchantName}</h3>
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusStyles[item.status] ?? statusStyles.suspected}`}>{item.status}</span>
                    </div>
                    <p className="mt-1 text-sm text-neutral-600">
                      {formatCurrency(item.amountMin)}-{formatCurrency(item.amountMax)} · {item.cadence} · next {item.nextExpectedDate ?? "unknown"} · {item.usageType}
                    </p>
                    {item.priceIncreaseDetected ? <p className="mt-2 text-sm font-semibold text-orange-700">Price increased. Decide if it still earns its place.</p> : null}
                    {(item.usageType === "unknown" || item.usageType === "mixed") ? <p className="mt-1 text-sm font-semibold text-blue-700">Usage unknown. Personal vs business matters here.</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    <Button type="button" variant="secondary" disabled={busy} onClick={() => void updateItem(item.id, { status: "confirmed" })}>Confirm</Button>
                    <Button type="button" variant="secondary" disabled={busy} onClick={() => void updateItem(item.id, { status: "ignored" })}>Ignore</Button>
                    <Button type="button" variant="ghost" disabled={busy} onClick={() => void updateItem(item.id, { status: "cancelled" })}>Cancel</Button>
                    <Button type="button" variant="ghost" disabled={busy} onClick={() => void updateItem(item.id, { usageType: "personal" })}>Personal</Button>
                    <Button type="button" variant="ghost" disabled={busy} onClick={() => void updateItem(item.id, { usageType: "business" })}>Business</Button>
                    <Button type="button" variant="ghost" disabled={busy} onClick={() => void updateItem(item.id, { usageType: "mixed" })}>Mixed</Button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
