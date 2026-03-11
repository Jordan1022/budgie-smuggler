import { NextResponse } from "next/server";
import { z } from "zod";
import { startOfMonth } from "date-fns";
import { getRouteUser, unauthorized } from "@/lib/route-auth";
import { getBudgets } from "@/lib/server-data";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  month: z.string().optional(),
  rows: z.array(
    z.object({
      categoryId: z.string().uuid(),
      amountLimit: z.number().nonnegative(),
      rolloverEnabled: z.boolean().optional(),
    }),
  ),
});

export async function GET() {
  const user = await getRouteUser();
  if (!user) {
    return unauthorized();
  }

  const data = await getBudgets(user.id);
  return NextResponse.json(data);
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
  const db = prisma;

  const monthStart = parsed.data.month ? startOfMonth(new Date(parsed.data.month)) : startOfMonth(new Date());

  await Promise.all(
    parsed.data.rows.map((row) =>
      db.monthlyBudget.upsert({
        where: {
          ownerUserId_monthStart_categoryId: {
            ownerUserId: user.id,
            monthStart,
            categoryId: row.categoryId,
          },
        },
        create: {
          ownerUserId: user.id,
          monthStart,
          categoryId: row.categoryId,
          amountLimit: row.amountLimit,
          rolloverEnabled: row.rolloverEnabled ?? false,
        },
        update: {
          amountLimit: row.amountLimit,
          rolloverEnabled: row.rolloverEnabled ?? false,
        },
      }),
    ),
  );

  return NextResponse.json({ ok: true, source: "database" });
}
