import { Badge } from "@/components/ui/badge";

export function DataSourceBanner({ source }: { source: "mock" | "database" }) {
  if (source === "database") {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
        Connected to your database and showing live user-scoped records.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
      <p className="font-medium">Running in sample mode.</p>
      <p className="mt-1">Set environment variables and run DB migrations to enable live data.</p>
      <div className="mt-2">
        <Badge tone="warn">No external credentials loaded</Badge>
      </div>
    </div>
  );
}
