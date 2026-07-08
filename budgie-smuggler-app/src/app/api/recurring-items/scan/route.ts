import { NextResponse } from "next/server";
import { scanRecurringItems } from "@/lib/recurring/service";
import { getRouteUser, unauthorized } from "@/lib/route-auth";

export async function POST() {
  const user = await getRouteUser();
  if (!user) {
    return unauthorized();
  }

  const result = await scanRecurringItems(user.id);

  return NextResponse.json(result);
}
