"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AccountItem = {
  id: string;
  name: string;
  type?: string | null;
  usageType: string;
  sourceType: string;
  lastImportedAt?: string | null;
};

type ImportSummary = {
  total: number;
  needsReview: number;
  duplicateCandidates: number;
  suggested: number;
};

const accountTypes = ["checking", "savings", "credit_card", "loan", "cash", "other"];
const usageTypes = ["personal", "business", "mixed", "unknown"];

export function ImportUploadForm({
  initialAccounts,
  source,
}: {
  initialAccounts: AccountItem[];
  source: "mock" | "database";
}) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [selectedAccountId, setSelectedAccountId] = useState(initialAccounts[0]?.id ?? "");
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountType, setNewAccountType] = useState("checking");
  const [newUsageType, setNewUsageType] = useState("unknown");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const selectedAccount = useMemo(() => accounts.find((account) => account.id === selectedAccountId), [accounts, selectedAccountId]);

  async function createAccount() {
    if (!newAccountName.trim()) {
      setMessage("Account name is required.");
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newAccountName,
          type: newAccountType,
          usageType: newUsageType,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Could not create account.");
      }

      const payload = await response.json();
      setAccounts((current) => [...current, payload.account]);
      setSelectedAccountId(payload.account.id);
      setNewAccountName("");
      setMessage(`Created ${payload.account.name}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Account creation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadCsv() {
    if (!selectedAccountId || !file) {
      setMessage("Choose an account and CSV file.");
      return;
    }

    setBusy(true);
    setMessage(null);
    setSummary(null);

    try {
      const formData = new FormData();
      formData.set("bankAccountId", selectedAccountId);
      formData.set("file", file);

      const response = await fetch("/api/imports", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Could not import CSV.");
      }

      setSummary(payload.summary);
      setMessage(`Imported ${payload.summary.total} rows from ${file.name}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
      <section className="rounded-2xl border border-[var(--line)] bg-white p-4">
        <div>
          <h2 className="text-lg font-semibold">Upload statement CSV</h2>
          <p className="text-sm text-neutral-600">Source: {source}</p>
        </div>

        <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-sm font-medium">
            Account
            <select
              className="h-11 rounded-xl border border-[var(--line)] bg-white px-3 text-sm"
              value={selectedAccountId}
              onChange={(event) => setSelectedAccountId(event.target.value)}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.usageType})
                </option>
              ))}
            </select>
          </label>

          {selectedAccount ? (
            <p className="rounded-xl bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
              Importing into {selectedAccount.name}. Default use: {selectedAccount.usageType}.
            </p>
          ) : null}

          <label className="grid gap-1 text-sm font-medium">
            CSV file
            <Input accept=".csv,text/csv" type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </label>

          <Button disabled={busy || !selectedAccountId || !file} type="button" onClick={uploadCsv}>
            Upload CSV
          </Button>
        </div>

        {message ? <p className="mt-3 text-sm font-semibold text-neutral-700">{message}</p> : null}

        {summary ? (
          <div className="mt-4 rounded-xl border border-[var(--line)] bg-neutral-50 p-3 text-sm">
            <p className="font-semibold">Imported {summary.total} rows.</p>
            <p>{summary.needsReview} need review.</p>
            <p>{summary.duplicateCandidates} look like possible duplicates.</p>
            <Link className="mt-3 inline-flex font-semibold text-blue-700" href="/review">
              Go to review
            </Link>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-[var(--line)] bg-white p-4">
        <h2 className="text-lg font-semibold">Create manual account</h2>
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-sm font-medium">
            Name
            <Input value={newAccountName} onChange={(event) => setNewAccountName(event.target.value)} placeholder="Capital One card" />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Type
            <select
              className="h-11 rounded-xl border border-[var(--line)] bg-white px-3 text-sm"
              value={newAccountType}
              onChange={(event) => setNewAccountType(event.target.value)}
            >
              {accountTypes.map((type) => (
                <option key={type} value={type}>
                  {type.replace("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Use
            <select
              className="h-11 rounded-xl border border-[var(--line)] bg-white px-3 text-sm"
              value={newUsageType}
              onChange={(event) => setNewUsageType(event.target.value)}
            >
              {usageTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <Button disabled={busy} type="button" variant="secondary" onClick={createAccount}>
            Create account
          </Button>
        </div>
      </section>
    </div>
  );
}
