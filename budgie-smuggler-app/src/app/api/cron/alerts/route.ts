import { NextResponse } from "next/server";
import { runAlertsForUser } from "@/lib/alert-jobs";
import { prisma } from "@/lib/prisma";

export async function POST() {
  if (!prisma) {
    return NextResponse.json({ ok: true, skipped: true, reason: "Database is not configured." });
  }

  const profiles = await prisma.profile.findMany({
    select: {
      id: true,
    },
    take: 500,
  });

  const results = [];
  for (const profile of profiles) {
    const outcome = await runAlertsForUser(profile.id);
    results.push({ userId: profile.id, ...outcome });
  }

  return NextResponse.json({ ok: true, results });
}
