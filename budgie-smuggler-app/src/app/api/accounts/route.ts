import { NextResponse } from "next/server";
import { z } from "zod";
import { getRouteUser, unauthorized } from "@/lib/route-auth";
import { prisma } from "@/lib/prisma";

const createAccountSchema = z.object({
  name: z.string().trim().min(1).max(120),
  institutionName: z.string().trim().max(120).optional(),
  type: z.enum(["checking", "savings", "credit_card", "loan", "cash", "other"]).default("checking"),
  usageType: z.enum(["personal", "business", "mixed", "unknown"]).default("unknown"),
  currentBalance: z.number().finite().optional(),
});

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
      sourceType: account.sourceType,
      usageType: account.usageType,
      currentBalance: account.currentBalance?.toNumber() ?? 0,
      availableBalance: account.availableBalance?.toNumber() ?? 0,
      lastImportedAt: account.lastImportedAt?.toISOString() ?? null,
    })),
    source: "database",
  });
}

export async function POST(request: Request) {
  const user = await getRouteUser();
  if (!user) {
    return unauthorized();
  }

  const parsed = createAccountSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (!prisma) {
    return NextResponse.json({
      account: {
        id: "mock-account",
        name: parsed.data.name,
        type: parsed.data.type,
        usageType: parsed.data.usageType,
        sourceType: "manual",
      },
      source: "mock",
    });
  }

  const account = await prisma.bankAccount.create({
    data: {
      ownerUserId: user.id,
      name: parsed.data.name,
      type: parsed.data.type,
      subtype: parsed.data.institutionName || null,
      usageType: parsed.data.usageType,
      sourceType: "manual",
      currentBalance: parsed.data.currentBalance ?? null,
      lastBalanceAt: parsed.data.currentBalance === undefined ? null : new Date(),
    },
  });

  return NextResponse.json({
    account: {
      id: account.id,
      name: account.name,
      type: account.type,
      usageType: account.usageType,
      sourceType: account.sourceType,
      currentBalance: account.currentBalance?.toNumber() ?? 0,
      lastImportedAt: account.lastImportedAt?.toISOString() ?? null,
    },
    source: "database",
  });
}
