export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-4">
      <div className="rounded-2xl border border-[var(--line)] bg-white p-6 text-center">
        <h1 className="text-2xl font-bold">You are offline</h1>
        <p className="mt-2 text-sm text-neutral-600">Reconnect to fetch live transactions and sync status.</p>
      </div>
    </main>
  );
}
