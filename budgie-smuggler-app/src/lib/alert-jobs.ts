import { format, startOfMonth, subMonths } from "date-fns";
import { buildOverspendDedupeKey, buildThresholdDedupeKey, evaluateTriggeredThresholds, shouldTriggerUnusualSpend } from "@/lib/alerts";
import { getAlertFromEmail, createResendClient } from "@/lib/email";
import { isEmailConfigured } from "@/lib/env";
import { getDashboardData } from "@/lib/server-data";
import { prisma } from "@/lib/prisma";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type AlertPreferences = {
  enabled: boolean;
  thresholdPercents: number[];
  weeklyDigestDay: number;
  unusualSpendMultiplier: number;
  channels: {
    email: boolean;
    push: boolean;
    inApp: boolean;
  };
  notifyOn: {
    threshold: boolean;
    overspend: boolean;
    unusualSpend: boolean;
    weeklyDigest: boolean;
  };
};

const DEFAULT_PREFS: AlertPreferences = {
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

async function resolveUserEmail(userId: string) {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (error || !data.user?.email) {
      return null;
    }

    return data.user.email;
  } catch {
    return null;
  }
}

function mergePreferences(config: unknown, enabled: boolean): AlertPreferences {
  if (!config || typeof config !== "object") {
    return {
      ...DEFAULT_PREFS,
      enabled,
    };
  }

  const record = config as Record<string, unknown>;
  const channels = record.channels as Record<string, unknown> | undefined;
  const notifyOn = record.notifyOn as Record<string, unknown> | undefined;

  return {
    enabled,
    thresholdPercents: Array.isArray(record.thresholdPercents)
      ? record.thresholdPercents.filter((value): value is number => typeof value === "number")
      : DEFAULT_PREFS.thresholdPercents,
    weeklyDigestDay: typeof record.weeklyDigestDay === "number" ? record.weeklyDigestDay : DEFAULT_PREFS.weeklyDigestDay,
    unusualSpendMultiplier:
      typeof record.unusualSpendMultiplier === "number" ? record.unusualSpendMultiplier : DEFAULT_PREFS.unusualSpendMultiplier,
    channels: {
      email: typeof channels?.email === "boolean" ? channels.email : DEFAULT_PREFS.channels.email,
      push: typeof channels?.push === "boolean" ? channels.push : DEFAULT_PREFS.channels.push,
      inApp: typeof channels?.inApp === "boolean" ? channels.inApp : DEFAULT_PREFS.channels.inApp,
    },
    notifyOn: {
      threshold: typeof notifyOn?.threshold === "boolean" ? notifyOn.threshold : DEFAULT_PREFS.notifyOn.threshold,
      overspend: typeof notifyOn?.overspend === "boolean" ? notifyOn.overspend : DEFAULT_PREFS.notifyOn.overspend,
      unusualSpend: typeof notifyOn?.unusualSpend === "boolean" ? notifyOn.unusualSpend : DEFAULT_PREFS.notifyOn.unusualSpend,
      weeklyDigest: typeof notifyOn?.weeklyDigest === "boolean" ? notifyOn.weeklyDigest : DEFAULT_PREFS.notifyOn.weeklyDigest,
    },
  };
}

export async function runAlertsForUser(userId: string) {
  const month = format(new Date(), "yyyy-MM");
  const data = await getDashboardData(userId);

  if (!prisma) {
    return { sent: 0, skipped: data.progress.length };
  }
  const db = prisma;

  const alert = await db.alert.upsert({
    where: {
      ownerUserId_type: {
        ownerUserId: userId,
        type: "preferences",
      },
    },
    create: {
      ownerUserId: userId,
      type: "preferences",
      channel: "email",
      enabled: true,
      config: {
        ...DEFAULT_PREFS,
      },
    },
    update: {},
  });

  const prefs = mergePreferences(alert.config, alert.enabled);
  if (!prefs.enabled) {
    return { sent: 0, skipped: data.progress.length };
  }

  const sentEvents: { subject: string; text: string; dedupeKey: string }[] = [];

  const trailingStart = subMonths(startOfMonth(new Date()), 3);
  const trailingEnd = startOfMonth(new Date());
  const trailingRows = await db.transaction.groupBy({
    by: ["categoryId"],
    where: {
      ownerUserId: userId,
      direction: "debit",
      categoryId: {
        not: null,
      },
      postedDate: {
        gte: trailingStart,
        lt: trailingEnd,
      },
    },
    _sum: {
      amount: true,
    },
  });
  const trailingAverage = new Map(
    trailingRows.map((row) => [row.categoryId, ((row._sum.amount?.toNumber() ?? 0) / 3) as number]),
  );

  for (const budget of data.progress) {
    if (prefs.notifyOn.threshold) {
      const thresholds = evaluateTriggeredThresholds(budget.percentUsed, prefs.thresholdPercents);
      for (const threshold of thresholds) {
        const dedupeKey = buildThresholdDedupeKey({ budgetId: budget.budgetId, month, threshold });
        const exists = await db.alertEvent.findFirst({
          where: {
            ownerUserId: userId,
            dedupeKey,
          },
        });

        if (!exists) {
          sentEvents.push({
            subject: `Budget threshold reached: ${budget.categoryName}`,
            text: `You reached ${threshold}% of your ${budget.categoryName} budget.`,
            dedupeKey,
          });
        }
      }
    }

    if (prefs.notifyOn.overspend && budget.percentUsed >= 100) {
      const dedupeKey = buildOverspendDedupeKey({ budgetId: budget.budgetId, month });
      const exists = await db.alertEvent.findFirst({
        where: {
          ownerUserId: userId,
          dedupeKey,
        },
      });

      if (!exists) {
        sentEvents.push({
          subject: `Budget exceeded: ${budget.categoryName}`,
          text: `You are over budget in ${budget.categoryName}.`,
          dedupeKey,
        });
      }
    }

    if (prefs.notifyOn.unusualSpend) {
      const trailing = trailingAverage.get(budget.categoryId) ?? 0;
      const isUnusual = shouldTriggerUnusualSpend({
        current: budget.spent,
        trailingAverage: trailing,
        multiplier: prefs.unusualSpendMultiplier,
      });

      if (isUnusual) {
        const dedupeKey = `unusual:${budget.budgetId}:${month}`;
        const exists = await db.alertEvent.findFirst({
          where: {
            ownerUserId: userId,
            dedupeKey,
          },
        });

        if (!exists) {
          sentEvents.push({
            subject: `Unusual spending: ${budget.categoryName}`,
            text: `${budget.categoryName} spending is above your recent monthly average.`,
            dedupeKey,
          });
        }
      }
    }
  }

  if (prefs.notifyOn.weeklyDigest && new Date().getDay() === prefs.weeklyDigestDay) {
    const dedupeKey = `digest:${month}:${prefs.weeklyDigestDay}`;
    const exists = await db.alertEvent.findFirst({
      where: {
        ownerUserId: userId,
        dedupeKey,
      },
    });

    if (!exists) {
      const topRisk = data.progress
        .sort((a, b) => b.percentUsed - a.percentUsed)
        .slice(0, 3)
        .map((item) => `${item.categoryName} (${item.percentUsed.toFixed(0)}%)`)
        .join(", ");

      sentEvents.push({
        subject: "Weekly budget digest",
        text: topRisk ? `Top categories by budget usage: ${topRisk}.` : "No budget activity this week.",
        dedupeKey,
      });
    }
  }

  if (!sentEvents.length) {
    return { sent: 0, skipped: 0 };
  }

  const userEmail = await resolveUserEmail(userId);
  const canSendEmail = prefs.channels.email && isEmailConfigured() && Boolean(userEmail);

  if (canSendEmail && userEmail) {
    const resend = createResendClient();
    for (const event of sentEvents) {
      await resend.emails.send({
        from: getAlertFromEmail(),
        to: userEmail,
        subject: event.subject,
        text: event.text,
      });
    }
  }

  await Promise.all(
    sentEvents.map((event) =>
      db.alertEvent.create({
        data: {
          ownerUserId: userId,
          alertId: alert.id,
          status: canSendEmail ? "sent" : "queued",
          dedupeKey: event.dedupeKey,
          payload: {
            subject: event.subject,
            text: event.text,
            channels: prefs.channels,
          },
          sentAt: canSendEmail ? new Date() : null,
        },
      }),
    ),
  );

  return {
    sent: sentEvents.length,
    skipped: 0,
  };
}
