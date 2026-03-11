import type { User } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";

export async function ensureProfileRecord(user: User) {
  if (!prisma) {
    return;
  }

  await prisma.profile.upsert({
    where: {
      id: user.id,
    },
    create: {
      id: user.id,
      displayName: typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null,
      timezone: "America/Chicago",
      currency: "USD",
    },
    update: {
      displayName: typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : undefined,
    },
  });
}
