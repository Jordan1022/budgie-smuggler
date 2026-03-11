import { NextResponse } from "next/server";
import { z } from "zod";
import { getRouteUser, unauthorized } from "@/lib/route-auth";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  lockCategory: z.boolean().optional().default(true),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getRouteUser();
  if (!user) {
    return unauthorized();
  }

  if (!prisma) {
    return NextResponse.json({ ok: true, source: "mock" });
  }

  const { id } = await context.params;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await prisma.transaction.updateMany({
    where: {
      id,
      ownerUserId: user.id,
    },
    data: {
      categoryId: parsed.data.categoryId ?? null,
      userOverrideCategory: parsed.data.lockCategory,
    },
  });

  return NextResponse.json({ ok: true, source: "database" });
}
