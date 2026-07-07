import { NextResponse } from "next/server";
import { getRouteUser, unauthorized } from "@/lib/route-auth";
import { getImportedTransactionsForReview } from "@/lib/server-data";

export async function GET() {
  const user = await getRouteUser();
  if (!user) {
    return unauthorized();
  }

  return NextResponse.json(await getImportedTransactionsForReview(user.id));
}
