"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

type Mode = "sign-in" | "sign-up";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const supabase = createBrowserSupabaseClient();

      if (mode === "sign-up") {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (signUpError) {
          throw signUpError;
        }

        setMessage("Check your email for a confirmation link.");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

        if (signInError) {
          throw signInError;
        }

        router.push("/dashboard");
        router.refresh();
      }
    } catch (submitError) {
      const normalized = submitError instanceof Error ? submitError.message : "Authentication failed.";
      setError(normalized);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm">
      <h1 className="text-2xl font-bold tracking-tight">{mode === "sign-up" ? "Create account" : "Sign in"}</h1>
      <p className="text-sm text-neutral-600">Your data stays private to your own login.</p>

      {mode === "sign-up" ? (
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Full name</span>
          <Input required value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Jordan Allen" />
        </label>
      ) : null}

      <label className="block space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Email</span>
        <Input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@email.com" />
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Password</span>
        <Input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} />
      </label>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Please wait..." : mode === "sign-up" ? "Create account" : "Sign in"}
      </Button>

      <p className="text-sm text-neutral-600">
        {mode === "sign-up" ? "Already have an account?" : "Need an account?"} {" "}
        <Link href={mode === "sign-up" ? "/sign-in" : "/sign-up"} className="font-semibold text-[var(--ink)] underline">
          {mode === "sign-up" ? "Sign in" : "Create one"}
        </Link>
      </p>
    </form>
  );
}
