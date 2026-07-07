import { RecurringConsole } from "@/components/recurring/recurring-console";
import { requireUser } from "@/lib/auth";
import { getRecurringPageData } from "@/lib/server-data";

export default async function RecurringPage() {
  const user = await requireUser();
  const data = await getRecurringPageData(user.id);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Recurring</h1>
        <p className="text-sm text-neutral-600">Find subscriptions and recurring charges, then decide what stays.</p>
      </header>

      <RecurringConsole initialItems={data.items} source={data.source} />
    </div>
  );
}
