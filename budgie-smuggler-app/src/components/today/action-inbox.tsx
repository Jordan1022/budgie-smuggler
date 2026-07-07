type ActionItem = {
  id: string;
  title: string;
  body?: string | null;
  priority: string;
  dueDate?: string | null;
};

const priorityStyles: Record<string, string> = {
  urgent: "bg-red-50 text-red-700",
  high: "bg-orange-50 text-orange-700",
  normal: "bg-blue-50 text-blue-700",
  low: "bg-neutral-100 text-neutral-600",
};

export function ActionInbox({ items }: { items: ActionItem[] }) {
  const visibleItems = items.slice(0, 5);

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Do now</h2>
          <p className="text-sm text-neutral-600">{items.length} open item{items.length === 1 ? "" : "s"}</p>
        </div>
      </div>

      {visibleItems.length === 0 ? (
        <p className="mt-4 rounded-xl bg-neutral-50 px-3 py-2 text-sm text-neutral-700">No open money tasks. Import fresh data if this feels wrong.</p>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--line)]">
          {visibleItems.map((item) => (
            <li key={item.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{item.title}</p>
                  {item.body ? <p className="mt-1 text-sm text-neutral-600">{item.body}</p> : null}
                  {item.dueDate ? <p className="mt-1 text-xs text-neutral-500">Due {item.dueDate}</p> : null}
                </div>
                <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${priorityStyles[item.priority] ?? priorityStyles.normal}`}>
                  {item.priority}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
