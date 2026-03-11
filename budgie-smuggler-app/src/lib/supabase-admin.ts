import { createClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured } from "@/lib/env";

export function createSupabaseAdminClient() {
  const parsed = env();
  if (!isSupabaseConfigured() || !parsed.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase admin client is not configured.");
  }

  return createClient(parsed.NEXT_PUBLIC_SUPABASE_URL, parsed.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
