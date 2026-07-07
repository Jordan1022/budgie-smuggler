import type { Prisma } from "@prisma/client";
import { createActionItems } from "@/lib/action-items";
import { prisma } from "@/lib/prisma";
import { buildDebtActionItems } from "./actions";
import { calculateUtilization, estimateMonthlyInterest, getDebtPressure, rankPayoffCandidates } from "./calculations";

type DecimalLike = Prisma.Decimal | number | null | undefined;

export type DebtAccountWriteInput = {
  bankAccountId?: string | null;
  name: string;
  debtType: string;
  usageType: string;
  balance: number;
  apr?: number | null;
  minimumPayment?: number | null;
  paymentDueDay?: number | null;
  nextDueDate?: Date | string | null;
  statementCloseDay?: number | null;
  creditLimit?: number | null;
  promoApr?: number | null;
  promoAprExpiresOn?: Date | string | null;
  spendingStatus?: string;
  lastPaymentAmount?: number | null;
  lastPaymentDate?: Date | string | null;
  lastStatementBalance?: number | null;
  notes?: string | null;
};

export type DebtAccountView = DebtAccountWriteInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
  utilization: number | null;
  estimatedMonthlyInterest: number | null;
  pressureLabel: "missing_info" | "urgent" | "high" | "normal";
  pressureReasons: string[];
};

export type DebtSummary = {
  totalBalance: number;
  estimatedMonthlyInterest: number;
  missingDetailCount: number;
  highestAprTarget: { id: string; name: string; apr: number; balance: number } | null;
};

function toNumber(value: DecimalLike) {
  if (value === null || value === undefined) {
    return null;
  }

  return typeof value === "number" ? value : value.toNumber();
}

function parseDate(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value : new Date(`${value}T00:00:00`);
}

function toDateString(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : null;
}

function mapDebtAccount(row: Prisma.DebtAccountGetPayload<Record<string, never>>): DebtAccountView {
  const balance = toNumber(row.balance) ?? 0;
  const apr = toNumber(row.apr);
  const minimumPayment = toNumber(row.minimumPayment);
  const creditLimit = toNumber(row.creditLimit);
  const pressure = getDebtPressure({ balance, apr, minimumPayment, nextDueDate: row.nextDueDate, creditLimit });

  return {
    id: row.id,
    bankAccountId: row.bankAccountId,
    name: row.name,
    debtType: row.debtType,
    usageType: row.usageType,
    balance,
    apr,
    minimumPayment,
    paymentDueDay: row.paymentDueDay,
    nextDueDate: toDateString(row.nextDueDate),
    statementCloseDay: row.statementCloseDay,
    creditLimit,
    promoApr: toNumber(row.promoApr),
    promoAprExpiresOn: toDateString(row.promoAprExpiresOn),
    spendingStatus: row.spendingStatus,
    lastPaymentAmount: toNumber(row.lastPaymentAmount),
    lastPaymentDate: toDateString(row.lastPaymentDate),
    lastStatementBalance: toNumber(row.lastStatementBalance),
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    utilization: calculateUtilization({ balance, creditLimit }),
    estimatedMonthlyInterest: estimateMonthlyInterest({ balance, apr }),
    pressureLabel: pressure.label,
    pressureReasons: pressure.reasons,
  };
}

function createData(userId: string, input: DebtAccountWriteInput) {
  return {
    ownerUserId: userId,
    bankAccountId: input.bankAccountId ?? null,
    name: input.name,
    debtType: input.debtType ?? "credit_card",
    usageType: input.usageType ?? "unknown",
    balance: input.balance,
    apr: input.apr ?? null,
    minimumPayment: input.minimumPayment ?? null,
    paymentDueDay: input.paymentDueDay ?? null,
    nextDueDate: parseDate(input.nextDueDate),
    statementCloseDay: input.statementCloseDay ?? null,
    creditLimit: input.creditLimit ?? null,
    promoApr: input.promoApr ?? null,
    promoAprExpiresOn: parseDate(input.promoAprExpiresOn),
    spendingStatus: input.spendingStatus ?? "active",
    lastPaymentAmount: input.lastPaymentAmount ?? null,
    lastPaymentDate: parseDate(input.lastPaymentDate),
    lastStatementBalance: input.lastStatementBalance ?? null,
    notes: input.notes ?? null,
  };
}

function updateData(input: Partial<DebtAccountWriteInput>) {
  return {
    bankAccountId: input.bankAccountId,
    name: input.name,
    debtType: input.debtType,
    usageType: input.usageType,
    balance: input.balance,
    apr: input.apr,
    minimumPayment: input.minimumPayment,
    paymentDueDay: input.paymentDueDay,
    nextDueDate: input.nextDueDate === undefined ? undefined : parseDate(input.nextDueDate),
    statementCloseDay: input.statementCloseDay,
    creditLimit: input.creditLimit,
    promoApr: input.promoApr,
    promoAprExpiresOn: input.promoAprExpiresOn === undefined ? undefined : parseDate(input.promoAprExpiresOn),
    spendingStatus: input.spendingStatus,
    lastPaymentAmount: input.lastPaymentAmount,
    lastPaymentDate: input.lastPaymentDate === undefined ? undefined : parseDate(input.lastPaymentDate),
    lastStatementBalance: input.lastStatementBalance,
    notes: input.notes,
  };
}

export async function listDebtAccounts(userId: string): Promise<DebtAccountView[]> {
  if (!prisma) {
    return [
      {
        id: "mock-debt",
        bankAccountId: null,
        name: "Sample Credit Card",
        debtType: "credit_card",
        usageType: "personal",
        balance: 2400,
        apr: 29.99,
        minimumPayment: 85,
        paymentDueDay: 15,
        nextDueDate: new Date().toISOString().slice(0, 10),
        statementCloseDay: 20,
        creditLimit: 3000,
        promoApr: null,
        promoAprExpiresOn: null,
        spendingStatus: "active",
        lastPaymentAmount: null,
        lastPaymentDate: null,
        lastStatementBalance: null,
        notes: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        utilization: 80,
        estimatedMonthlyInterest: 59.98,
        pressureLabel: "high",
        pressureReasons: ["Utilization is 80% or higher"],
      },
    ];
  }

  const rows = await prisma.debtAccount.findMany({
    where: { ownerUserId: userId },
    orderBy: [{ nextDueDate: "asc" }, { name: "asc" }],
  });

  return rows.map(mapDebtAccount);
}

export async function createDebtAccount(userId: string, input: DebtAccountWriteInput): Promise<DebtAccountView> {
  if (!prisma) {
    return (await listDebtAccounts(userId))[0];
  }

  const row = await prisma.debtAccount.create({
    data: createData(userId, input) as Prisma.DebtAccountUncheckedCreateInput,
  });

  return mapDebtAccount(row);
}

export async function updateDebtAccount(userId: string, id: string, input: Partial<DebtAccountWriteInput>): Promise<DebtAccountView | null> {
  if (!prisma) {
    return (await listDebtAccounts(userId))[0] ?? null;
  }

  const existing = await prisma.debtAccount.findFirst({
    where: { id, ownerUserId: userId },
  });

  if (!existing) {
    return null;
  }

  const row = await prisma.debtAccount.update({
    where: { id },
    data: updateData(input) as Prisma.DebtAccountUncheckedUpdateInput,
  });

  return mapDebtAccount(row);
}

export async function deleteDebtAccount(userId: string, id: string): Promise<boolean> {
  if (!prisma) {
    return true;
  }

  const result = await prisma.debtAccount.deleteMany({
    where: { id, ownerUserId: userId },
  });

  return result.count > 0;
}

export async function summarizeDebt(userId: string): Promise<DebtSummary> {
  const accounts = await listDebtAccounts(userId);
  const payoffCandidates = accounts.map((account) => ({
    id: account.id,
    name: account.name,
    balance: account.balance,
    apr: account.apr ?? null,
    minimumPayment: account.minimumPayment ?? null,
    nextDueDate: account.nextDueDate,
    creditLimit: account.creditLimit ?? null,
  }));
  const highestAprTarget = rankPayoffCandidates(payoffCandidates)[0] ?? null;

  return {
    totalBalance: accounts.reduce((sum, account) => sum + account.balance, 0),
    estimatedMonthlyInterest: accounts.reduce((sum, account) => sum + (account.estimatedMonthlyInterest ?? 0), 0),
    missingDetailCount: accounts.filter((account) => account.pressureLabel === "missing_info").length,
    highestAprTarget: highestAprTarget
      ? { id: highestAprTarget.id, name: highestAprTarget.name ?? "Debt", apr: highestAprTarget.apr ?? 0, balance: highestAprTarget.balance }
      : null,
  };
}

export async function refreshDebtActionItems(userId: string) {
  const accounts = await listDebtAccounts(userId);
  const actionInputs = accounts.map((account) => ({
    id: account.id,
    name: account.name,
    balance: account.balance,
    apr: account.apr ?? null,
    minimumPayment: account.minimumPayment ?? null,
    nextDueDate: account.nextDueDate,
    creditLimit: account.creditLimit ?? null,
  }));

  return createActionItems(userId, buildDebtActionItems(userId, actionInputs));
}
