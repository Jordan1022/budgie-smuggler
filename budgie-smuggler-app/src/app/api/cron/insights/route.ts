import { NextResponse } from "next/server";
import { generateInsightsForUser } from "@/lib/insights";
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
    const insights = await generateInsightsForUser(profile.id);
    results.push({ userId: profile.id, created: insights.length });
  }

  return NextResponse.json({ ok: true, results });
}
