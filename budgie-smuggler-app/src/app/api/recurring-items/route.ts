import { NextResponse } from "next/server";
import { listRecurringItems } from "@/lib/recurring/service";
import { getRouteUser, unauthorized } from "@/lib/route-auth";

export async function GET() {
  const user = await getRouteUser();
  if (!user) {
    return unauthorized();
  }

  const items = await listRecurringItems(user.id);

  return NextResponse.json({
    items,
    source: items.length && items[0].id === "mock-recurring" ? "mock" : "database",
  });
}
