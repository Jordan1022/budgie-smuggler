import { ActionInbox } from "@/components/today/action-inbox";
import { RealitySummary } from "@/components/today/reality-summary";
import { requireUser } from "@/lib/auth";
import { getTodayData } from "@/lib/today";

export default async function TodayPage() {
  const user = await requireUser();
  const data = await getTodayData(user.id);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Today</h1>
        <p className="text-sm text-neutral-600">Do the next concrete thing. No vague budgeting homework.</p>
      </header>

      <RealitySummary reality={data.reality} source={data.source} />
      <ActionInbox items={data.actionItems} />
    </div>
  );
}
