import { subMonths } from "date-fns";
import { prisma } from "@/lib/prisma";

function toNumber(input: unknown) {
  if (typeof input === "number") {
    return input;
  }

  if (input && typeof input === "object" && "toNumber" in input && typeof input.toNumber === "function") {
    return input.toNumber() as number;
  }

  return Number(input ?? 0);
}

export async function generateInsightsForUser(userId: string) {
  if (!prisma) {
    return [];
  }

  const currentStart = subMonths(new Date(), 1);
  const previousStart = subMonths(new Date(), 2);

  const current = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: {
      ownerUserId: userId,
      direction: "debit",
      postedDate: {
        gte: currentStart,
      },
    },
    _sum: {
      amount: true,
    },
  });

  const previous = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: {
      ownerUserId: userId,
      direction: "debit",
      postedDate: {
        gte: previousStart,
        lt: currentStart,
      },
    },
    _sum: {
      amount: true,
    },
  });

  const previousMap = new Map(previous.map((row) => [row.categoryId, toNumber(row._sum.amount)]));

  const insights = current
    .map((row) => {
      const categoryId = row.categoryId ?? "uncategorized";
      const currentAmount = toNumber(row._sum.amount);
      const previousAmount = previousMap.get(row.categoryId) ?? 0;
      const delta = previousAmount === 0 ? 100 : ((currentAmount - previousAmount) / previousAmount) * 100;

      return {
        insightType: "trend_delta",
        summary: `${categoryId} changed ${delta >= 0 ? "up" : "down"} ${Math.abs(delta).toFixed(1)}% month over month.`,
        details: {
          categoryId,
          currentAmount,
          previousAmount,
          delta,
        },
      };
    })
    .sort((a, b) => Math.abs((b.details as { delta: number }).delta) - Math.abs((a.details as { delta: number }).delta))
    .slice(0, 3);

  for (const insight of insights) {
    await prisma.insightSnapshot.create({
      data: {
        ownerUserId: userId,
        windowStart: currentStart,
        windowEnd: new Date(),
        insightType: insight.insightType,
        summary: insight.summary,
        details: insight.details,
      },
    });
  }

  return insights;
}
