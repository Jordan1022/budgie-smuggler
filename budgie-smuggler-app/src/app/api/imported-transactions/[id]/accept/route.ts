import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRouteUser, unauthorized } from "@/lib/route-auth";

const acceptSchema = z
  .object({
    acceptDuplicate: z.boolean().optional().default(false),
  })
  .optional();

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getRouteUser();
  if (!user) {
    return unauthorized();
  }

  const parsed = acceptSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (!prisma) {
    return NextResponse.json({ ok: true, transactionId: "mock-transaction", source: "mock" });
  }

  const { id } = await context.params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const staged = await tx.importedTransaction.findFirst({
        where: {
          id,
          ownerUserId: user.id,
        },
      });

      if (!staged) {
        return { status: 404 as const, error: "Imported transaction not found." };
      }

      if (staged.acceptedTransactionId) {
        return { status: 409 as const, error: "Imported transaction has already been accepted." };
      }

      if (staged.duplicateTransactionId && !parsed.data?.acceptDuplicate) {
        return { status: 409 as const, error: "Possible duplicate. Confirm before accepting.", duplicateTransactionId: staged.duplicateTransactionId };
      }

      const transaction = await tx.transaction.create({
        data: {
          ownerUserId: user.id,
          bankAccountId: staged.bankAccountId,
          postedDate: staged.parsedDate,
          merchantName: staged.normalizedDescription,
          description: staged.rawDescription,
          amount: staged.amount,
          direction: staged.direction,
          pending: false,
          sourceType: "csv",
          sourceImportBatchId: staged.importBatchId,
          usageType: staged.detectedUsageType,
          cashFlowRole: staged.detectedCashFlowRole,
          reviewStatus: "accepted",
          confidence: staged.confidence,
        },
      });

      await tx.importedTransaction.update({
        where: {
          id: staged.id,
        },
        data: {
          reviewStatus: "accepted",
          acceptedTransactionId: transaction.id,
        },
      });

      return { status: 200 as const, transactionId: transaction.id };
    });

    if (result.status !== 200) {
      return NextResponse.json(result, { status: result.status });
    }

    return NextResponse.json({ ok: true, transactionId: result.transactionId, source: "database" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Accept failed." }, { status: 400 });
  }
}
