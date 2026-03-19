import { AlertPreferencesForm } from "@/components/forms/alert-preferences-form";
import { PlaidLinkManager } from "@/components/forms/plaid-link-manager";
import { requireUser } from "@/lib/auth";
import { isDatabaseConfigured, isEmailConfigured, isPlaidConfigured, isSupabaseConfigured } from "@/lib/env";
import { getAlertPreferences } from "@/lib/server-data";

export default async function SettingsPage() {
  const user = await requireUser();
  const { alerts, source } = await getAlertPreferences(user.id);
  const supabaseReady = isSupabaseConfigured();
  const databaseReady = isDatabaseConfigured();
  const plaidReady = isPlaidConfigured();
  const emailReady = isEmailConfigured();

  const checks = [
    { name: "Supabase", ok: supabaseReady },
    { name: "Postgres", ok: databaseReady },
    { name: "Plaid", ok: plaidReady },
    { name: "Resend", ok: emailReady },
  ];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-neutral-600">Account and integration status for {user.email ?? "your account"}.</p>
      </header>

      <section className="rounded-2xl border border-[var(--line)] bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">Integration readiness</h2>
        <ul className="space-y-2">
          {checks.map((check) => (
            <li key={check.name} className="flex items-center justify-between rounded-lg border border-[var(--line)] px-3 py-2 text-sm">
              <span>{check.name}</span>
              <span className={check.ok ? "text-emerald-600" : "text-amber-700"}>{check.ok ? "Configured" : "Missing"}</span>
            </li>
          ))}
        </ul>
      </section>

      <PlaidLinkManager canUsePlaid={plaidReady} canUseDatabase={databaseReady} />

      <AlertPreferencesForm initialPreferences={alerts} source={source} />

      <form action="/api/auth/sign-out" method="post">
        <button className="rounded-xl border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold hover:bg-neutral-50" type="submit">
          Sign out
        </button>
      </form>
    </div>
  );
}
