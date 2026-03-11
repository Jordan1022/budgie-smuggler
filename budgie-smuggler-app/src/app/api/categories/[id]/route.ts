import { NextResponse } from "next/server";
import { z } from "zod";
import { getRouteUser, unauthorized } from "@/lib/route-auth";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  color: z.string().trim().min(4).max(20).nullable().optional(),
  icon: z.string().trim().min(1).max(40).nullable().optional(),
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

  await prisma.category.updateMany({
    where: {
      id,
      ownerUserId: user.id,
    },
    data: {
      name: parsed.data.name,
      color: parsed.data.color ?? undefined,
      icon: parsed.data.icon ?? undefined,
    },
  });

  return NextResponse.json({ ok: true, source: "database" });
}
