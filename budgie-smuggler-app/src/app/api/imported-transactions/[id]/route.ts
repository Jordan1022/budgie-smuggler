import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRouteUser, unauthorized } from "@/lib/route-auth";

const updateSchema = z.object({
  detectedCategory: z.string().trim().max(120).nullable().optional(),
  detectedUsageType: z.enum(["personal", "business", "mixed", "unknown"]).optional(),
  detectedCashFlowRole: z.enum(["spending", "income", "transfer", "debt_payment", "interest", "fee", "refund", "other"]).optional(),
  reviewStatus: z.enum(["needs_review", "suggested", "confirmed", "ignored"]).optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
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

  const { id } = await context.params;
  const updated = await prisma.importedTransaction.updateMany({
    where: {
      id,
      ownerUserId: user.id,
    },
    data: parsed.data,
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "Imported transaction not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, source: "database" });
}
