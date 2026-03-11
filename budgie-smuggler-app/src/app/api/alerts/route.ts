import { NextResponse } from "next/server";
import { z } from "zod";
import { getRouteUser, unauthorized } from "@/lib/route-auth";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  enabled: z.boolean(),
  thresholdPercents: z.array(z.number()).default([50, 80, 100]),
  weeklyDigestDay: z.number().int().min(0).max(6).default(1),
  unusualSpendMultiplier: z.number().min(1.1).default(1.3),
  channels: z
    .object({
      email: z.boolean().default(true),
      push: z.boolean().default(false),
      inApp: z.boolean().default(true),
    })
    .default({ email: true, push: false, inApp: true }),
  notifyOn: z
    .object({
      threshold: z.boolean().default(true),
      overspend: z.boolean().default(true),
      unusualSpend: z.boolean().default(true),
      weeklyDigest: z.boolean().default(false),
    })
    .default({ threshold: true, overspend: true, unusualSpend: true, weeklyDigest: false }),
});

const defaultAlerts = {
  enabled: true,
  thresholdPercents: [50, 80, 100],
  weeklyDigestDay: 1,
  unusualSpendMultiplier: 1.3,
  channels: {
    email: true,
    push: false,
    inApp: true,
  },
  notifyOn: {
    threshold: true,
    overspend: true,
    unusualSpend: true,
    weeklyDigest: false,
  },
};

export async function GET() {
  const user = await getRouteUser();
  if (!user) {
    return unauthorized();
  }

  if (!prisma) {
    return NextResponse.json({
      alerts: {
        ...defaultAlerts,
      },
      source: "mock",
    });
  }

  const row = await prisma.alert.findFirst({
    where: {
      ownerUserId: user.id,
      type: "preferences",
    },
  });

  const config = row && typeof row.config === "object" && row.config !== null ? (row.config as Record<string, unknown>) : {};
  const channels = config.channels && typeof config.channels === "object" ? (config.channels as Record<string, unknown>) : {};
  const notifyOn = config.notifyOn && typeof config.notifyOn === "object" ? (config.notifyOn as Record<string, unknown>) : {};
  const resolved = {
    ...defaultAlerts,
    ...config,
    enabled: row?.enabled ?? defaultAlerts.enabled,
    channels: {
      ...defaultAlerts.channels,
      ...channels,
    },
    notifyOn: {
      ...defaultAlerts.notifyOn,
      ...notifyOn,
    },
  };

  return NextResponse.json({
    alerts: resolved,
    source: "database",
  });
}

export async function PUT(request: Request) {
  const user = await getRouteUser();
  if (!user) {
    return unauthorized();
  }

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (!prisma) {
    return NextResponse.json({ ok: true, source: "mock" });
  }

  await prisma.alert.upsert({
    where: {
      ownerUserId_type: {
        ownerUserId: user.id,
        type: "preferences",
      },
    },
    create: {
      ownerUserId: user.id,
      type: "preferences",
      channel: parsed.data.channels.email ? "email" : "in_app",
      enabled: parsed.data.enabled,
      config: {
        thresholdPercents: parsed.data.thresholdPercents,
        weeklyDigestDay: parsed.data.weeklyDigestDay,
        unusualSpendMultiplier: parsed.data.unusualSpendMultiplier,
        channels: parsed.data.channels,
        notifyOn: parsed.data.notifyOn,
      },
    },
    update: {
      channel: parsed.data.channels.email ? "email" : "in_app",
      enabled: parsed.data.enabled,
      config: {
        thresholdPercents: parsed.data.thresholdPercents,
        weeklyDigestDay: parsed.data.weeklyDigestDay,
        unusualSpendMultiplier: parsed.data.unusualSpendMultiplier,
        channels: parsed.data.channels,
        notifyOn: parsed.data.notifyOn,
      },
    },
  });

  return NextResponse.json({ ok: true, source: "database" });
}
