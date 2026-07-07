import { NextResponse } from "next/server";
import { importCsvForAccount } from "@/lib/imports/service";
import { prisma } from "@/lib/prisma";
import { getRouteUser, unauthorized } from "@/lib/route-auth";

export async function GET() {
  const user = await getRouteUser();
  if (!user) {
    return unauthorized();
  }

  if (!prisma) {
    return NextResponse.json({ imports: [], source: "mock" });
  }

  const rows = await prisma.importBatch.findMany({
    where: { ownerUserId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      bankAccount: true,
      _count: {
        select: {
          transactions: true,
        },
      },
    },
  });

  return NextResponse.json({
    imports: rows.map((row) => ({
      id: row.id,
      fileName: row.fileName,
      accountName: row.bankAccount.name,
      parserStatus: row.parserStatus,
      transactionCount: row._count.transactions,
      createdAt: row.createdAt.toISOString(),
    })),
    source: "database",
  });
}

export async function POST(request: Request) {
  const user = await getRouteUser();
  if (!user) {
    return unauthorized();
  }

  const formData = await request.formData();
  const bankAccountId = String(formData.get("bankAccountId") ?? "");
  const file = formData.get("file");

  if (!bankAccountId || !(file instanceof File)) {
    return NextResponse.json({ error: "bankAccountId and file are required." }, { status: 400 });
  }

  if (!file.name.toLowerCase().endsWith(".csv")) {
    return NextResponse.json({ error: "Only CSV imports are supported in this version." }, { status: 400 });
  }

  try {
    const result = await importCsvForAccount({
      userId: user.id,
      bankAccountId,
      fileName: file.name,
      csvText: await file.text(),
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Import failed." }, { status: 400 });
  }
}
