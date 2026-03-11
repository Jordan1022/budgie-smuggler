import { NextResponse } from "next/server";
import { getRouteUser, unauthorized } from "@/lib/route-auth";
import { createPlaidLinkToken } from "@/lib/plaid-sync";
import { isPlaidConfigured } from "@/lib/env";

export async function POST() {
  const user = await getRouteUser();
  if (!user) {
    return unauthorized();
  }

  if (!isPlaidConfigured()) {
    return NextResponse.json({ error: "Plaid is not configured." }, { status: 503 });
  }

  try {
    const linkToken = await createPlaidLinkToken(user.id);
    return NextResponse.json({ linkToken });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create link token." }, { status: 500 });
  }
}
