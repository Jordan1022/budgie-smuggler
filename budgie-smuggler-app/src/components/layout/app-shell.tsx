import Image from "next/image";
import Link from "next/link";
import { APP_NAME, NAV_ITEMS } from "@/lib/constants";
import { MobileNav } from "@/components/layout/mobile-nav";

export function AppShell({
  userEmail,
  children,
}: {
  userEmail: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 pb-24 pt-4 md:grid-cols-[220px_1fr] md:px-6 md:pb-8 md:pt-6">
        <aside className="hidden rounded-2xl border border-[var(--line)] bg-white p-4 md:block">
          <h1 className="mb-4 inline-flex items-center gap-2 text-xl font-bold tracking-tight">
            <span className="relative inline-flex h-5 w-5 shrink-0 overflow-hidden rounded-sm">
              <Image src="/budgie-mark.png" alt="Budgie logo mark" fill className="object-contain" sizes="20px" />
            </span>
            <span>{APP_NAME}</span>
          </h1>
          <nav>
            <ul className="space-y-2">
              {NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  <Link className="block rounded-lg px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100" href={item.href}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <p className="mt-6 text-xs text-neutral-500">Signed in as {userEmail}</p>
        </aside>

        <main className="space-y-4">{children}</main>
      </div>
      <MobileNav />
    </div>
  );
}
