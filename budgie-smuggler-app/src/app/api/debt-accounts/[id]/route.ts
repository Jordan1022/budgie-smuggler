import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteDebtAccount, refreshDebtActionItems, updateDebtAccount } from "@/lib/debt/service";
import { getRouteUser, unauthorized } from "@/lib/route-auth";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const optionalMoney = z.number().finite().nullable().optional();
const optionalDay = z.number().int().min(1).max(31).nullable().optional();

const updateSchema = z.object({
  bankAccountId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(120).optional(),
  debtType: z.enum(["credit_card", "personal_loan", "business_loan", "line_of_credit", "medical", "tax", "other"]).optional(),
  usageType: z.enum(["personal", "business", "mixed", "unknown"]).optional(),
  balance: z.number().finite().optional(),
  apr: optionalMoney,
  minimumPayment: optionalMoney,
  paymentDueDay: optionalDay,
  nextDueDate: dateString.nullable().optional(),
  statementCloseDay: optionalDay,
  creditLimit: optionalMoney,
  promoApr: optionalMoney,
  promoAprExpiresOn: dateString.nullable().optional(),
  spendingStatus: z.enum(["active", "paused", "closed"]).optional(),
  lastPaymentAmount: optionalMoney,
  lastPaymentDate: dateString.nullable().optional(),
  lastStatementBalance: optionalMoney,
  notes: z.string().trim().max(1000).nullable().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getRouteUser();
  if (!user) {
    return unauthorized();
  }

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id } = await context.params;
  const account = await updateDebtAccount(user.id, id, parsed.data);
  if (!account) {
    return NextResponse.json({ error: "Debt account not found." }, { status: 404 });
  }

  await refreshDebtActionItems(user.id);

  return NextResponse.json({
    account,
    source: account.id === "mock-debt" ? "mock" : "database",
  });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getRouteUser();
  if (!user) {
    return unauthorized();
  }

  const { id } = await context.params;
  const deleted = await deleteDebtAccount(user.id, id);
  if (!deleted) {
    return NextResponse.json({ error: "Debt account not found." }, { status: 404 });
  }

  await refreshDebtActionItems(user.id);

  return NextResponse.json({ ok: true });
}
