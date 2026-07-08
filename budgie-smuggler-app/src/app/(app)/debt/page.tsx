import { DebtConsole } from "@/components/debt/debt-console";
import { requireUser } from "@/lib/auth";
import { getDebtPageData } from "@/lib/server-data";

export default async function DebtPage() {
  const user = await requireUser();
  const data = await getDebtPageData(user.id);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Debt</h1>
        <p className="text-sm text-neutral-600">Every card and loan needs APR, minimum payment, due date, and a plan.</p>
      </header>

      <DebtConsole initialAccounts={data.accounts} summary={data.summary} source={data.source} />
    </div>
  );
}
