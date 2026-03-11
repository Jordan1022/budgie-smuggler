import { NextResponse } from "next/server";
import { z } from "zod";
import { getRouteUser, unauthorized } from "@/lib/route-auth";
import { getCategories } from "@/lib/server-data";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  color: z.string().trim().min(4).max(20).optional(),
  icon: z.string().trim().min(1).max(40).optional(),
});

export async function GET() {
  const user = await getRouteUser();
  if (!user) {
    return unauthorized();
  }

  const categories = await getCategories(user.id);
  return NextResponse.json({ categories });
}

export async function POST(request: Request) {
  const user = await getRouteUser();
  if (!user) {
    return unauthorized();
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (!prisma) {
    return NextResponse.json({ ok: true, source: "mock" });
  }

  const category = await prisma.category.create({
    data: {
      ownerUserId: user.id,
      name: parsed.data.name,
      color: parsed.data.color,
      icon: parsed.data.icon,
      isSystem: false,
    },
  });

  return NextResponse.json({ category, source: "database" }, { status: 201 });
}
