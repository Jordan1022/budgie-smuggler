import { requireUser } from "@/lib/auth";
import { getInsights } from "@/lib/server-data";

export default async function InsightsPage() {
  const user = await requireUser();
  const { insights, source } = await getInsights(user.id);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Insights</h1>
        <p className="text-sm text-neutral-600">Rule-based trends and suggestions. Source: {source}.</p>
      </header>

      <section className="space-y-3">
        {insights.map((insight) => (
          <article key={insight.id} className="rounded-2xl border border-[var(--line)] bg-white p-4">
            <h2 className="font-semibold">{insight.summary}</h2>
            <p className="mt-1 text-sm text-neutral-600">{insight.details}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
