import { NextResponse } from "next/server";
import { getRouteUser, unauthorized } from "@/lib/route-auth";
import { getTransactions } from "@/lib/server-data";

export async function GET() {
  const user = await getRouteUser();
  if (!user) {
    return unauthorized();
  }

  const data = await getTransactions(user.id);
  return NextResponse.json(data);
}
