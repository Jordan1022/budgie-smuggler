import { NextResponse } from "next/server";
import { z } from "zod";
import { createDebtAccount, listDebtAccounts, refreshDebtActionItems, summarizeDebt } from "@/lib/debt/service";
import { getRouteUser, unauthorized } from "@/lib/route-auth";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const optionalMoney = z.number().finite().nullable().optional();
const optionalDay = z.number().int().min(1).max(31).nullable().optional();

const debtAccountSchema = z.object({
  bankAccountId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(120),
  debtType: z.enum(["credit_card", "personal_loan", "business_loan", "line_of_credit", "medical", "tax", "other"]).default("credit_card"),
  usageType: z.enum(["personal", "business", "mixed", "unknown"]).default("unknown"),
  balance: z.number().finite(),
  apr: optionalMoney,
  minimumPayment: optionalMoney,
  paymentDueDay: optionalDay,
  nextDueDate: dateString.nullable().optional(),
  statementCloseDay: optionalDay,
  creditLimit: optionalMoney,
  promoApr: optionalMoney,
  promoAprExpiresOn: dateString.nullable().optional(),
  spendingStatus: z.enum(["active", "paused", "closed"]).default("active"),
  lastPaymentAmount: optionalMoney,
  lastPaymentDate: dateString.nullable().optional(),
  lastStatementBalance: optionalMoney,
  notes: z.string().trim().max(1000).nullable().optional(),
});

export async function GET() {
  const user = await getRouteUser();
  if (!user) {
    return unauthorized();
  }

  const [accounts, summary] = await Promise.all([listDebtAccounts(user.id), summarizeDebt(user.id)]);

  return NextResponse.json({
    accounts,
    summary,
    source: accounts.length && accounts[0].id === "mock-debt" ? "mock" : "database",
  });
}

export async function POST(request: Request) {
  const user = await getRouteUser();
  if (!user) {
    return unauthorized();
  }

  const parsed = debtAccountSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const account = await createDebtAccount(user.id, parsed.data);
  await refreshDebtActionItems(user.id);

  return NextResponse.json({
    account,
    source: account.id === "mock-debt" ? "mock" : "database",
  });
}
