import { NextResponse } from "next/server";
import { z } from "zod";
import { getRouteUser, unauthorized } from "@/lib/route-auth";
import { createDefaultCategories, exchangePublicToken } from "@/lib/plaid-sync";
import { isPlaidConfigured } from "@/lib/env";

const schema = z.object({
  publicToken: z.string().min(10),
});

export async function POST(request: Request) {
  const user = await getRouteUser();
  if (!user) {
    return unauthorized();
  }

  if (!isPlaidConfigured()) {
    return NextResponse.json({ error: "Plaid is not configured." }, { status: 503 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await exchangePublicToken(user.id, parsed.data.publicToken);
    await createDefaultCategories(user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Token exchange failed." }, { status: 500 });
  }
}
