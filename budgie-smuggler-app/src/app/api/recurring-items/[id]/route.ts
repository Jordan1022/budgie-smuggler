import { NextResponse } from "next/server";
import { z } from "zod";
import { refreshRecurringActionItems, updateRecurringItem } from "@/lib/recurring/service";
import { getRouteUser, unauthorized } from "@/lib/route-auth";

const updateSchema = z.object({
  status: z.enum(["suspected", "confirmed", "ignored", "cancelled"]).optional(),
  usageType: z.enum(["personal", "business", "mixed", "unknown"]).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
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

  const { id } = await context.params;
  const result = await updateRecurringItem(user.id, id, parsed.data);
  if (!result) {
    return NextResponse.json({ error: "Recurring item not found." }, { status: 404 });
  }

  await refreshRecurringActionItems(user.id);

  return NextResponse.json(result);
}
