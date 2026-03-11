import { NextResponse } from "next/server";
import { getRouteUser, unauthorized } from "@/lib/route-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getRouteUser();
  if (!user) {
    return unauthorized();
  }

  if (!prisma) {
    return NextResponse.json({ accounts: [], source: "mock" });
  }

  const accounts = await prisma.bankAccount.findMany({
    where: {
      ownerUserId: user.id,
    },
    orderBy: {
      name: "asc",
    },
  });

  return NextResponse.json({
    accounts: accounts.map((account) => ({
      id: account.id,
      name: account.name,
      mask: account.mask,
      type: account.type,
      subtype: account.subtype,
      currentBalance: account.currentBalance?.toNumber() ?? 0,
      availableBalance: account.availableBalance?.toNumber() ?? 0,
    })),
    source: "database",
  });
}
