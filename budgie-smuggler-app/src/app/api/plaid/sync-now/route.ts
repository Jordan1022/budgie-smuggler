import { NextResponse } from "next/server";
import { getRouteUser, unauthorized } from "@/lib/route-auth";
import { syncAllPlaidItemsForUser } from "@/lib/plaid-sync";

export async function POST() {
  const user = await getRouteUser();
  if (!user) {
    return unauthorized();
  }

  const result = await syncAllPlaidItemsForUser(user.id);
  return NextResponse.json(result);
}
