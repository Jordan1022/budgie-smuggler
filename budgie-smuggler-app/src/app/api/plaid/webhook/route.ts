import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncPlaidItemTransactions } from "@/lib/plaid-sync";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  const itemId = typeof body.item_id === "string" ? body.item_id : null;
  if (!itemId || !prisma) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const item = await prisma.plaidItem.findFirst({
    where: {
      plaidItemId: itemId,
    },
    select: {
      id: true,
      ownerUserId: true,
    },
  });

  if (!item) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  try {
    await syncPlaidItemTransactions({
      userId: item.ownerUserId,
      plaidItemRefId: item.id,
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
