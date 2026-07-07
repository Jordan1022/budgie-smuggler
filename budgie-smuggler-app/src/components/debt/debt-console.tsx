"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { DebtAccountView, DebtSummary } from "@/lib/debt/service";

type DebtFormState = {
  name: string;
  debtType: string;
  usageType: string;
  balance: string;
  apr: string;
  minimumPayment: string;
  nextDueDate: string;
  creditLimit: string;
  spendingStatus: string;
  notes: string;
};

const emptyForm: DebtFormState = {
  name: "",
  debtType: "credit_card",
  usageType: "unknown",
  balance: "",
  apr: "",
  minimumPayment: "",
  nextDueDate: "",
  creditLimit: "",
  spendingStatus: "active",
  notes: "",
};

const debtTypes = ["credit_card", "personal_loan", "business_loan", "line_of_credit", "medical", "tax", "other"];
const usageTypes = ["personal", "business", "mixed", "unknown"];
const spendingStatuses = ["active", "paused", "closed"];

function toNumber(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formFromAccount(account: DebtAccountView): DebtFormState {
  return {
    name: account.name,
    debtType: account.debtType,
    usageType: account.usageType,
    balance: String(account.balance),
    apr: account.apr === null || account.apr === undefined ? "" : String(account.apr),
    minimumPayment: account.minimumPayment === null || account.minimumPayment === undefined ? "" : String(account.minimumPayment),
    nextDueDate: typeof account.nextDueDate === "string" ? account.nextDueDate : "",
    creditLimit: account.creditLimit === null || account.creditLimit === undefined ? "" : String(account.creditLimit),
    spendingStatus: account.spendingStatus ?? "active",
    notes: account.notes ?? "",
  };
}

export function DebtConsole({
  initialAccounts,
  summary,
  source,
}: {
  initialAccounts: DebtAccountView[];
  summary: DebtSummary;
  source: "mock" | "database";
}) {
  const router = useRouter();
  const [accounts, setAccounts] = useState(initialAccounts);
  const [form, setForm] = useState<DebtFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const currentSummary = useMemo(() => {
    if (accounts === initialAccounts) {
      return summary;
    }

    return {
      totalBalance: accounts.reduce((sum, account) => sum + account.balance, 0),
      estimatedMonthlyInterest: accounts.reduce((sum, account) => sum + (account.estimatedMonthlyInterest ?? 0), 0),
      missingDetailCount: accounts.filter((account) => account.pressureLabel === "missing_info").length,
      highestAprTarget:
        [...accounts].filter((account) => account.apr !== null && account.apr !== undefined).sort((left, right) => (right.apr ?? 0) - (left.apr ?? 0))[0] ??
        null,
    };
  }, [accounts, initialAccounts, summary]);

  function updateField(field: keyof DebtFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function requestBody() {
    return {
      name: form.name.trim(),
      debtType: form.debtType,
      usageType: form.usageType,
      balance: toNumber(form.balance) ?? 0,
      apr: toNumber(form.apr),
      minimumPayment: toNumber(form.minimumPayment),
      nextDueDate: form.nextDueDate || null,
      creditLimit: toNumber(form.creditLimit),
      spendingStatus: form.spendingStatus,
      notes: form.notes.trim() || null,
    };
  }

  async function submitDebt() {
    if (!form.name.trim()) {
      setMessage("Debt name is required.");
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch(editingId ? `/api/debt-accounts/${editingId}` : "/api/debt-accounts", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody()),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ? JSON.stringify(payload.error) : "Could not save debt account.");
      }

      setAccounts((current) => {
        const account = payload.account as DebtAccountView;
        return editingId ? current.map((item) => (item.id === account.id ? account : item)) : [...current, account];
      });
      setForm(emptyForm);
      setEditingId(null);
      setMessage("Debt saved. Now keep the details honest.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save debt account.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteDebt(id: string) {
    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/debt-accounts/${id}`, { method: "DELETE" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Could not delete debt account.");
      }

      setAccounts((current) => current.filter((account) => account.id !== id));
      setMessage("Debt row removed.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete debt account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Debt balance</p>
          <p className="mt-2 text-2xl font-bold">{formatCurrency(currentSummary.totalBalance)}</p>
          <p className="mt-2 text-sm">This is the number that has to go down.</p>
        </div>
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Monthly interest</p>
          <p className="mt-2 text-2xl font-bold">{formatCurrency(currentSummary.estimatedMonthlyInterest)}</p>
          <p className="mt-2 text-sm">Estimated drag from APRs you entered.</p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Missing details</p>
          <p className="mt-2 text-2xl font-bold">{currentSummary.missingDetailCount}</p>
          <p className="mt-2 text-sm text-neutral-600">APR, minimum payment, or due date missing.</p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Payoff target</p>
          <p className="mt-2 text-xl font-bold">{currentSummary.highestAprTarget?.name ?? "Add APRs"}</p>
          <p className="mt-2 text-sm text-neutral-600">
            {currentSummary.highestAprTarget ? `${formatPercent(currentSummary.highestAprTarget.apr ?? 0)} APR` : "APR missing. You are flying blind on this debt."}
          </p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Debt accounts</h2>
              <p className="text-sm text-neutral-600">Source: {source}</p>
            </div>
          </div>

          <div className="mt-4 divide-y divide-[var(--line)]">
            {accounts.length === 0 ? (
              <p className="rounded-xl bg-neutral-50 px-3 py-3 text-sm text-neutral-700">No debt accounts yet. Add every card and loan. Partial truth is still confusion.</p>
            ) : (
              accounts.map((account) => (
                <article key={account.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h3 className="font-semibold">{account.name}</h3>
                      <p className="text-sm text-neutral-600">
                        {account.debtType.replaceAll("_", " ")} · {account.usageType} · {account.spendingStatus}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                        <span className="rounded-full bg-neutral-100 px-2 py-1">APR {account.apr === null || account.apr === undefined ? "missing" : formatPercent(account.apr)}</span>
                        <span className="rounded-full bg-neutral-100 px-2 py-1">Min {account.minimumPayment ? formatCurrency(account.minimumPayment) : "missing"}</span>
                        <span className="rounded-full bg-neutral-100 px-2 py-1">
                          Due {account.nextDueDate instanceof Date ? account.nextDueDate.toISOString().slice(0, 10) : account.nextDueDate ?? "missing"}
                        </span>
                        {account.utilization !== null ? <span className="rounded-full bg-neutral-100 px-2 py-1">Utilization {account.utilization}%</span> : null}
                      </div>
                      {account.pressureReasons.length ? <p className="mt-2 text-sm font-semibold text-red-700">{account.pressureReasons.join(". ")}.</p> : null}
                    </div>
                    <div className="min-w-40 text-left lg:text-right">
                      <p className="text-lg font-bold">{formatCurrency(account.balance)}</p>
                      <p className="text-sm text-neutral-600">Interest est. {formatCurrency(account.estimatedMonthlyInterest ?? 0)}/mo</p>
                      <div className="mt-3 flex gap-2 lg:justify-end">
                        <Button type="button" variant="secondary" onClick={() => { setEditingId(account.id); setForm(formFromAccount(account)); }}>
                          Edit
                        </Button>
                        <Button type="button" variant="ghost" disabled={busy} onClick={() => void deleteDebt(account.id)}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
          <h2 className="text-lg font-semibold">{editingId ? "Edit debt" : "Add debt"}</h2>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-1 text-sm font-medium">
              Name
              <Input value={form.name} onChange={(event) => updateField("name", event.target.value)} placeholder="Capital One Venture" />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium">
                Type
                <select className="h-11 rounded-xl border border-[var(--line)] bg-white px-3 text-sm" value={form.debtType} onChange={(event) => updateField("debtType", event.target.value)}>
                  {debtTypes.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Use
                <select className="h-11 rounded-xl border border-[var(--line)] bg-white px-3 text-sm" value={form.usageType} onChange={(event) => updateField("usageType", event.target.value)}>
                  {usageTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium">Balance<Input inputMode="decimal" value={form.balance} onChange={(event) => updateField("balance", event.target.value)} /></label>
              <label className="grid gap-1 text-sm font-medium">APR<Input inputMode="decimal" value={form.apr} onChange={(event) => updateField("apr", event.target.value)} /></label>
              <label className="grid gap-1 text-sm font-medium">Minimum payment<Input inputMode="decimal" value={form.minimumPayment} onChange={(event) => updateField("minimumPayment", event.target.value)} /></label>
              <label className="grid gap-1 text-sm font-medium">Credit limit<Input inputMode="decimal" value={form.creditLimit} onChange={(event) => updateField("creditLimit", event.target.value)} /></label>
            </div>
            <label className="grid gap-1 text-sm font-medium">Next due date<Input type="date" value={form.nextDueDate} onChange={(event) => updateField("nextDueDate", event.target.value)} /></label>
            <label className="grid gap-1 text-sm font-medium">
              Spending status
              <select className="h-11 rounded-xl border border-[var(--line)] bg-white px-3 text-sm" value={form.spendingStatus} onChange={(event) => updateField("spendingStatus", event.target.value)}>
                {spendingStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">Notes<Input value={form.notes} onChange={(event) => updateField("notes", event.target.value)} /></label>
            <div className="flex gap-2">
              <Button type="button" disabled={busy} onClick={() => void submitDebt()}>{editingId ? "Save debt" : "Add debt"}</Button>
              {editingId ? <Button type="button" variant="secondary" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Cancel</Button> : null}
            </div>
            {message ? <p className="text-sm font-semibold text-neutral-700">{message}</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
