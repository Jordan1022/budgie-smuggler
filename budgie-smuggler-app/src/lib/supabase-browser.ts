"use client";

import { createBrowserClient } from "@supabase/ssr";
import { env, isSupabaseConfigured } from "@/lib/env";

export function createBrowserSupabaseClient() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  const parsed = env();
  return createBrowserClient(parsed.NEXT_PUBLIC_SUPABASE_URL, parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
