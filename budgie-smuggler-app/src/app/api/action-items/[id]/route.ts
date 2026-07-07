import { NextResponse } from "next/server";
import { z } from "zod";
import { updateActionItemStatus } from "@/lib/action-items";
import { getRouteUser, unauthorized } from "@/lib/route-auth";

const statusSchema = z.object({
  status: z.enum(["open", "snoozed", "done", "dismissed"]),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getRouteUser();
  if (!user) {
    return unauthorized();
  }

  const parsed = statusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.status === "snoozed" && !parsed.data.dueDate) {
    return NextResponse.json({ error: "Snoozed action items require a dueDate." }, { status: 400 });
  }

  const { id } = await context.params;
  const dueDate = parsed.data.dueDate ? new Date(`${parsed.data.dueDate}T00:00:00`) : null;
  const result = await updateActionItemStatus(user.id, id, parsed.data.status, dueDate);

  if (!result.ok) {
    return NextResponse.json({ error: "Action item not found." }, { status: 404 });
  }

  return NextResponse.json(result);
}
