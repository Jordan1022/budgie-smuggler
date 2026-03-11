import { NextResponse } from "next/server";
import { z } from "zod";
import { getRouteUser, unauthorized } from "@/lib/route-auth";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
  timezone: z.string().trim().min(1).max(60).optional(),
  currency: z.string().trim().min(3).max(3).optional(),
});

export async function GET() {
  const user = await getRouteUser();
  if (!user) {
    return unauthorized();
  }

  if (!prisma) {
    return NextResponse.json({
      profile: {
        id: user.id,
        email: user.email,
        displayName: user.user_metadata?.full_name ?? null,
        timezone: "America/Chicago",
        currency: "USD",
      },
      source: "mock",
    });
  }

  const profile = await prisma.profile.findUnique({
    where: {
      id: user.id,
    },
  });

  return NextResponse.json({
    profile: {
      id: user.id,
      email: user.email,
      displayName: profile?.displayName ?? user.user_metadata?.full_name ?? null,
      timezone: profile?.timezone ?? "America/Chicago",
      currency: profile?.currency ?? "USD",
    },
    source: "database",
  });
}

export async function PATCH(request: Request) {
  const user = await getRouteUser();
  if (!user) {
    return unauthorized();
  }

  const json = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (!prisma) {
    return NextResponse.json({ ok: true, source: "mock" });
  }

  await prisma.profile.upsert({
    where: {
      id: user.id,
    },
    create: {
      id: user.id,
      displayName: parsed.data.displayName ?? user.user_metadata?.full_name ?? null,
      timezone: parsed.data.timezone ?? "America/Chicago",
      currency: parsed.data.currency ?? "USD",
    },
    update: {
      displayName: parsed.data.displayName,
      timezone: parsed.data.timezone,
      currency: parsed.data.currency,
    },
  });

  return NextResponse.json({ ok: true, source: "database" });
}
