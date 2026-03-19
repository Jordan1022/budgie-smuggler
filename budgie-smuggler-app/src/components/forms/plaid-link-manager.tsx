"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlaidLink } from "react-plaid-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Account = {
  id: string;
  name: string;
  mask: string | null;
  type: string | null;
  subtype: string | null;
  currentBalance: number;
  availableBalance: number;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

async function readErrorMessage(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const message = "error" in payload ? payload.error : null;
  return typeof message === "string" ? message : fallback;
}

export function PlaidLinkManager({
  canUsePlaid,
  canUseDatabase,
}: {
  canUsePlaid: boolean;
  canUseDatabase: boolean;
}) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(canUseDatabase);
  const [requestingLink, setRequestingLink] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [shouldOpenLink, setShouldOpenLink] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadAccounts = useEffectEvent(async () => {
    if (!canUseDatabase) {
      setAccounts([]);
      setLoadingAccounts(false);
      return;
    }

    setLoadingAccounts(true);
    try {
      const response = await fetch("/api/accounts", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Failed to load connected accounts."));
      }

      const payload = (await response.json()) as { accounts?: Account[] };
      setAccounts(Array.isArray(payload.accounts) ? payload.accounts : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load connected accounts.");
    } finally {
      setLoadingAccounts(false);
    }
  });

  useEffect(() => {
    void loadAccounts();
  }, [canUseDatabase, loadAccounts]);

  const handleSuccess = useEffectEvent(async (publicToken: string) => {
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/plaid/exchange-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ publicToken }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Failed to connect bank account."));
      }

      setMessage("Bank account connected. Transaction sync has started.");
      await loadAccounts();
      router.refresh();
    } catch (exchangeError) {
      setError(exchangeError instanceof Error ? exchangeError.message : "Failed to connect bank account.");
    } finally {
      setLinkToken(null);
      setShouldOpenLink(false);
    }
  });

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (publicToken) => {
      void handleSuccess(publicToken);
    },
    onExit: (plaidError) => {
      setShouldOpenLink(false);
      setLinkToken(null);
      if (plaidError?.error_message) {
        setError(plaidError.error_message);
      }
    },
  });

  useEffect(() => {
    if (!shouldOpenLink || !ready) {
      return;
    }

    open();
    setShouldOpenLink(false);
  }, [open, ready, shouldOpenLink]);

  async function connectBank() {
    if (!canUsePlaid || !canUseDatabase) {
      return;
    }

    setRequestingLink(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/plaid/link-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Failed to initialize Plaid Link."));
      }

      const payload = (await response.json()) as { linkToken?: string };
      if (!payload.linkToken) {
        throw new Error("Plaid Link token was missing from the server response.");
      }

      setLinkToken(payload.linkToken);
      setShouldOpenLink(true);
    } catch (linkError) {
      setError(linkError instanceof Error ? linkError.message : "Failed to initialize Plaid Link.");
    } finally {
      setRequestingLink(false);
    }
  }

  async function syncNow() {
    setSyncing(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/plaid/sync-now", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Failed to sync transactions."));
      }

      const payload = (await response.json()) as { synced?: number; errors?: string[] };
      if (Array.isArray(payload.errors) && payload.errors.length) {
        throw new Error(payload.errors.join(" "));
      }

      setMessage(
        typeof payload.synced === "number"
          ? `Synced ${payload.synced} connected ${payload.synced === 1 ? "item" : "items"}.`
          : "Transaction sync finished.",
      );
      await loadAccounts();
      router.refresh();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Failed to sync transactions.");
    } finally {
      setSyncing(false);
    }
  }

  const canConnect = canUsePlaid && canUseDatabase;

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Bank connections</h2>
            <Badge tone={accounts.length ? "info" : "warn"}>{accounts.length ? `${accounts.length} linked` : "No banks linked"}</Badge>
          </div>
          <p className="text-sm text-neutral-600">
            Connect your bank with Plaid, then sync transactions into your private budget workspace.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:items-end">
          <Button onClick={connectBank} disabled={!canConnect || requestingLink}>
            {requestingLink ? "Starting Plaid..." : "Connect bank"}
          </Button>
          <Button variant="secondary" onClick={syncNow} disabled={!accounts.length || syncing}>
            {syncing ? "Syncing..." : "Sync now"}
          </Button>
        </div>
      </div>

      {!canUsePlaid || !canUseDatabase ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Plaid linking requires valid Plaid credentials and a working database connection.
        </div>
      ) : null}

      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="mt-4 text-sm text-emerald-700">{message}</p> : null}

      <div className="mt-4 space-y-3">
        {loadingAccounts ? (
          <p className="text-sm text-neutral-500">Loading connected accounts...</p>
        ) : accounts.length ? (
          accounts.map((account) => (
            <article key={account.id} className="rounded-xl border border-[var(--line)] px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-[var(--ink)]">{account.name}</h3>
                  <p className="text-sm text-neutral-600">
                    {[account.type, account.subtype, account.mask ? `•••• ${account.mask}` : null].filter(Boolean).join(" · ")}
                  </p>
                </div>

                <div className="text-right text-sm">
                  <p className="font-semibold text-[var(--ink)]">{formatCurrency(account.currentBalance)}</p>
                  <p className="text-neutral-500">Current balance</p>
                  {account.availableBalance ? <p className="mt-1 text-neutral-500">Available {formatCurrency(account.availableBalance)}</p> : null}
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--line)] p-4 text-sm text-neutral-600">
            No connected bank accounts yet. Start with Sandbox, then relink in Limited Production when you are ready for live data.
          </div>
        )}
      </div>
    </section>
  );
}
