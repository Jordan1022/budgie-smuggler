import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { APP_NAME } from "@/lib/constants";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export default async function HomePage() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.auth.getUser();

    if (data.user) {
      redirect("/dashboard");
    }
  } catch {
    // Continue rendering public page when env is not configured.
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-5xl place-items-center px-4 py-10">
      <section className="w-full rounded-3xl border border-[var(--line)] bg-white p-6 shadow-sm sm:p-10">
        <div className="flex items-center gap-3">
          <span className="relative inline-flex h-8 w-8 shrink-0 overflow-hidden rounded-sm">
            <Image src="/bird.png" alt="Budgie logo mark" fill className="object-contain" sizes="32px" />
          </span>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{APP_NAME}</h1>
        </div>
        <p className="mt-3 inline-flex rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-wide">
          Private + Mobile-First
        </p>
        <p className="mt-4 max-w-2xl text-base text-neutral-700 sm:text-lg">
          Personal budgeting with secure bank sync, category budgets, and low-noise alerts. Every account is isolated by user profile.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/sign-up" className="inline-flex h-11 items-center justify-center rounded-xl bg-[var(--accent)] px-5 font-semibold">
            Create account
          </Link>
          <Link href="/sign-in" className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--line)] px-5 font-semibold">
            Sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
