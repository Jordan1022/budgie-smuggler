import { NextResponse } from "next/server";
import { listRecurringItemsWithSource } from "@/lib/recurring/service";
import { getRouteUser, unauthorized } from "@/lib/route-auth";

export async function GET() {
  const user = await getRouteUser();
  if (!user) {
    return unauthorized();
  }

  const result = await listRecurringItemsWithSource(user.id);

  return NextResponse.json(result);
}
