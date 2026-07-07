# Debt Recurring Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the debt account and recurring payment core that gives Budgie Smuggler a blunt, daily view of card pressure, missing debt details, subscriptions, and recurring charges.

**Architecture:** Extend the existing Next.js/Prisma/Supabase app in place. Add owner-scoped debt and recurring tables, keep calculations and detection as pure tested modules, expose thin API routes, and surface the results through `/debt`, `/recurring`, and existing Today action items. The slice uses rule-based detection and warnings only; AI chat, AI briefs, PDF parsing, and delivered reminders are separate slices.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma, Supabase Postgres/RLS, Vitest, Zod, date-fns, React client forms, existing Tailwind CSS tokens.

---

## Scope Decisions

- Implement debt accounts, recurring detection, subscription review, and Today action generation.
- Fix the existing `plaid-link-manager.tsx` hook lint issue first so final lint checks are actionable.
- Store reminders as existing `action_items`. Email, SMS, push, and calendar delivery are outside this slice.
- Use accepted ledger transactions only for recurring scans. Imported rows still in review do not count.
- Detect recurring items by normalized merchant, stable amount, and date cadence. AI assistance is not required for this slice.
- Add action item status updates so tasks can be marked `done`, `dismissed`, or `snoozed`.
- Keep PDF import, AI daily/weekly brief, Grok chat operator, advanced reports, and payoff simulation charts for later slices.

## File Structure

- Modify `budgie-smuggler-app/src/components/forms/plaid-link-manager.tsx`
  - Replace `useEffectEvent` with `useCallback` to satisfy the React hook lint rules.
- Modify `budgie-smuggler-app/prisma/schema.prisma`
  - Add `DebtAccount`, `RecurringItem`, and `RecurringTransactionLink`.
  - Add relations from `Profile`, `BankAccount`, `Category`, and `Transaction`.
- Create `budgie-smuggler-app/supabase/migrations/0005_debt_recurring_core.sql`
  - Mirror Prisma models, indexes, triggers, and RLS owner policies.
- Modify `budgie-smuggler-app/src/lib/money-control/constants.ts`
  - Add debt, recurring, cadence, and action type constants.
- Create `budgie-smuggler-app/src/lib/debt/calculations.ts`
  - Pure debt math: utilization, monthly interest, pressure, missing details, payoff priority.
- Create `budgie-smuggler-app/src/lib/debt/calculations.test.ts`
  - Unit coverage for debt math and warning thresholds.
- Create `budgie-smuggler-app/src/lib/debt/actions.ts`
  - Build action item inputs from debt accounts.
- Create `budgie-smuggler-app/src/lib/debt/actions.test.ts`
  - Unit coverage for missing details, due date, high utilization, and interest pressure actions.
- Create `budgie-smuggler-app/src/lib/debt/service.ts`
  - Database read/create/update/delete helpers and view-model mapping.
- Create `budgie-smuggler-app/src/lib/recurring/detection.ts`
  - Pure recurring detection from accepted transaction-like rows.
- Create `budgie-smuggler-app/src/lib/recurring/detection.test.ts`
  - Unit coverage for monthly/weekly/yearly cadence, price increases, and ignored one-offs.
- Create `budgie-smuggler-app/src/lib/recurring/actions.ts`
  - Build action item inputs from recurring items.
- Create `budgie-smuggler-app/src/lib/recurring/actions.test.ts`
  - Unit coverage for suspected item, price increase, and mixed usage actions.
- Create `budgie-smuggler-app/src/lib/recurring/service.ts`
  - Scan accepted transactions, upsert recurring items and links, and list/update recurring items.
- Modify `budgie-smuggler-app/src/lib/action-items.ts`
  - Add `updateActionItemStatus`, action dedupe support, and richer mock items.
- Modify `budgie-smuggler-app/src/lib/today.ts`
  - Include debt and recurring action creation before reading open action items.
  - Compute missing debt details from real debt rows.
- Modify `budgie-smuggler-app/src/lib/server-data.ts`
  - Add `getDebtPageData` and `getRecurringPageData`.
- Create `budgie-smuggler-app/src/app/api/debt-accounts/route.ts`
  - `GET` list debt accounts and summary; `POST` create a debt account.
- Create `budgie-smuggler-app/src/app/api/debt-accounts/[id]/route.ts`
  - `PATCH` update one debt account; `DELETE` remove one owner-scoped debt account.
- Create `budgie-smuggler-app/src/app/api/recurring-items/route.ts`
  - `GET` list recurring items.
- Create `budgie-smuggler-app/src/app/api/recurring-items/[id]/route.ts`
  - `PATCH` update status, usage type, category, and notes.
- Create `budgie-smuggler-app/src/app/api/recurring-items/scan/route.ts`
  - `POST` run detection against accepted transactions.
- Create `budgie-smuggler-app/src/app/api/action-items/[id]/route.ts`
  - `PATCH` mark action items done, dismissed, open, or snoozed.
- Create `budgie-smuggler-app/src/app/(app)/debt/page.tsx`
  - Server page for debt pressure, debt list, and debt form.
- Create `budgie-smuggler-app/src/app/(app)/recurring/page.tsx`
  - Server page for recurring summary, scan trigger, and recurring review.
- Create `budgie-smuggler-app/src/components/debt/debt-console.tsx`
  - Client UI for adding/editing debt and deleting stale debt rows.
- Create `budgie-smuggler-app/src/components/recurring/recurring-console.tsx`
  - Client UI for scanning and changing recurring item status.
- Modify `budgie-smuggler-app/src/components/today/action-inbox.tsx`
  - Add controls to mark actions done/dismissed/snoozed.
- Modify `budgie-smuggler-app/src/components/today/reality-summary.tsx`
  - Keep blunt messaging and show missing debt details from the real debt table.
- Modify `budgie-smuggler-app/src/lib/constants.ts`
  - Add `/debt` and `/recurring` to primary navigation.
- Modify `budgie-smuggler-app/README.md`
  - Document debt account setup, recurring scans, and the fact that reminders are in-app action items for this slice.

---

### Task 0: Create The Feature Branch

**Files:**
- No app files changed.

- [ ] **Step 1: Create branch from current main**

Run:

```bash
git switch -c debt-recurring-core
```

Expected:

```text
Switched to a new branch 'debt-recurring-core'
```

- [ ] **Step 2: Confirm clean branch**

Run:

```bash
git status --short
git branch --show-current
```

Expected:

```text
debt-recurring-core
```

`git status --short` should print nothing.

---

### Task 1: Fix Existing Plaid Hook Lint Failure

**Files:**
- Modify: `budgie-smuggler-app/src/components/forms/plaid-link-manager.tsx`

- [ ] **Step 1: Replace the import**

Change:

```ts
import { useEffect, useEffectEvent, useState } from "react";
```

To:

```ts
import { useCallback, useEffect, useState } from "react";
```

- [ ] **Step 2: Convert `loadAccounts` to `useCallback`**

Replace the `loadAccounts` declaration with:

```ts
  const loadAccounts = useCallback(async () => {
    if (!canUseDatabase) {
      setAccounts([]);
      setLoadingAccounts(false);
      return;
    }

    setLoadingAccounts(true);
    try {
      const response = await fetch("/api/accounts", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Failed to load connected accounts."));
      }

      const payload = (await response.json()) as { accounts?: Account[] };
      setAccounts(Array.isArray(payload.accounts) ? payload.accounts : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load connected accounts.");
    } finally {
      setLoadingAccounts(false);
    }
  }, [canUseDatabase]);
```

- [ ] **Step 3: Convert `handleSuccess` to `useCallback`**

Replace the `handleSuccess` declaration with:

```ts
  const handleSuccess = useCallback(
    async (publicToken: string) => {
      setError(null);
      setMessage(null);

      try {
        const response = await fetch("/api/plaid/exchange-token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ publicToken }),
        });

        if (!response.ok) {
          throw new Error(await readErrorMessage(response, "Failed to connect bank account."));
        }

        setMessage("Bank account connected. Transaction sync has started.");
        await loadAccounts();
        router.refresh();
      } catch (exchangeError) {
        setError(exchangeError instanceof Error ? exchangeError.message : "Failed to connect bank account.");
      } finally {
        setLinkToken(null);
        setShouldOpenLink(false);
      }
    },
    [loadAccounts, router],
  );
```

- [ ] **Step 4: Run lint for the file**

Run:

```bash
cd budgie-smuggler-app && npx eslint src/components/forms/plaid-link-manager.tsx
```

Expected: command exits with code `0`.

- [ ] **Step 5: Commit**

Run:

```bash
git add budgie-smuggler-app/src/components/forms/plaid-link-manager.tsx
git commit -m "fix: satisfy plaid link hook lint rules"
```

Expected: commit succeeds.

---

### Task 2: Schema, Migration, And Constants

**Files:**
- Modify: `budgie-smuggler-app/prisma/schema.prisma`
- Create: `budgie-smuggler-app/supabase/migrations/0005_debt_recurring_core.sql`
- Modify: `budgie-smuggler-app/src/lib/money-control/constants.ts`

- [ ] **Step 1: Extend constants**

Append this to `src/lib/money-control/constants.ts`:

```ts
export const DEBT_TYPES = ["credit_card", "personal_loan", "business_loan", "line_of_credit", "medical", "tax", "other"] as const;
export const DEBT_SPENDING_STATUSES = ["active", "paused", "closed"] as const;
export const RECURRING_CADENCES = ["weekly", "biweekly", "monthly", "quarterly", "yearly", "unknown"] as const;
export const RECURRING_STATUSES = ["suspected", "confirmed", "ignored", "cancelled"] as const;
export const RECURRING_SOURCES = ["rule", "manual"] as const;
export const MONEY_ACTION_TYPES = [
  "review_import",
  "complete_debt_details",
  "upcoming_debt_due",
  "high_utilization_debt",
  "debt_interest_pressure",
  "review_suspected_recurring",
  "review_price_increase",
  "review_cross_usage_recurring",
] as const;

export type DebtType = (typeof DEBT_TYPES)[number];
export type DebtSpendingStatus = (typeof DEBT_SPENDING_STATUSES)[number];
export type RecurringCadence = (typeof RECURRING_CADENCES)[number];
export type RecurringStatus = (typeof RECURRING_STATUSES)[number];
export type RecurringSource = (typeof RECURRING_SOURCES)[number];
export type MoneyActionType = (typeof MONEY_ACTION_TYPES)[number];
```

- [ ] **Step 2: Add Prisma relations**

Add these relation fields:

```prisma
model Profile {
  debtAccounts              DebtAccount[]
  recurringItems            RecurringItem[]
  recurringTransactionLinks RecurringTransactionLink[]
}

model BankAccount {
  debtAccounts DebtAccount[]
}

model Category {
  recurringItems RecurringItem[]
}

model Transaction {
  recurringLinks RecurringTransactionLink[]
}
```

Keep the existing fields in each model and insert only the new relation lines.

- [ ] **Step 3: Add Prisma models**

Append these models to `prisma/schema.prisma`:

```prisma
model DebtAccount {
  id                String    @id @default(uuid()) @db.Uuid
  ownerUserId       String    @map("owner_user_id") @db.Uuid
  bankAccountId     String?   @map("bank_account_id") @db.Uuid
  name              String
  debtType          String    @default("credit_card") @map("debt_type")
  usageType         String    @default("unknown") @map("usage_type")
  balance           Decimal   @db.Decimal(14, 2)
  apr               Decimal?  @db.Decimal(7, 4)
  minimumPayment    Decimal?  @map("minimum_payment") @db.Decimal(14, 2)
  paymentDueDay     Int?      @map("payment_due_day")
  nextDueDate       DateTime? @map("next_due_date") @db.Date
  statementCloseDay Int?      @map("statement_close_day")
  creditLimit       Decimal?  @map("credit_limit") @db.Decimal(14, 2)
  promoApr          Decimal?  @map("promo_apr") @db.Decimal(7, 4)
  promoAprExpiresOn DateTime? @map("promo_apr_expires_on") @db.Date
  spendingStatus    String    @default("active") @map("spending_status")
  lastPaymentAmount Decimal?  @map("last_payment_amount") @db.Decimal(14, 2)
  lastPaymentDate   DateTime? @map("last_payment_date") @db.Date
  lastStatementBalance Decimal? @map("last_statement_balance") @db.Decimal(14, 2)
  notes             String?
  createdAt         DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt         DateTime  @updatedAt @map("updated_at") @db.Timestamptz(6)

  owner       Profile      @relation(fields: [ownerUserId], references: [id], onDelete: Cascade)
  bankAccount BankAccount? @relation(fields: [bankAccountId], references: [id], onDelete: SetNull)

  @@index([ownerUserId])
  @@index([ownerUserId, nextDueDate])
  @@map("debt_accounts")
}

model RecurringItem {
  id                    String   @id @default(uuid()) @db.Uuid
  ownerUserId           String   @map("owner_user_id") @db.Uuid
  merchantName          String   @map("merchant_name")
  normalizedMerchantKey String   @map("normalized_merchant_key")
  usageType             String   @default("unknown") @map("usage_type")
  categoryId            String?  @map("category_id") @db.Uuid
  amountMin             Decimal  @map("amount_min") @db.Decimal(14, 2)
  amountMax             Decimal  @map("amount_max") @db.Decimal(14, 2)
  typicalAmount         Decimal  @map("typical_amount") @db.Decimal(14, 2)
  cadence               String   @default("unknown")
  nextExpectedDate      DateTime? @map("next_expected_date") @db.Date
  lastSeenDate          DateTime  @map("last_seen_date") @db.Date
  transactionCount      Int      @default(0) @map("transaction_count")
  status                String   @default("suspected")
  priceIncreaseDetected Boolean  @default(false) @map("price_increase_detected")
  increaseAmount        Decimal? @map("increase_amount") @db.Decimal(14, 2)
  source                String   @default("rule")
  notes                 String?
  createdAt             DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt             DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  owner    Profile                    @relation(fields: [ownerUserId], references: [id], onDelete: Cascade)
  category Category?                  @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  links    RecurringTransactionLink[]

  @@unique([ownerUserId, normalizedMerchantKey, cadence])
  @@index([ownerUserId, status])
  @@index([ownerUserId, nextExpectedDate])
  @@map("recurring_items")
}

model RecurringTransactionLink {
  id              String   @id @default(uuid()) @db.Uuid
  ownerUserId     String   @map("owner_user_id") @db.Uuid
  recurringItemId String   @map("recurring_item_id") @db.Uuid
  transactionId   String   @map("transaction_id") @db.Uuid
  createdAt       DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  owner         Profile       @relation(fields: [ownerUserId], references: [id], onDelete: Cascade)
  recurringItem RecurringItem @relation(fields: [recurringItemId], references: [id], onDelete: Cascade)
  transaction   Transaction   @relation(fields: [transactionId], references: [id], onDelete: Cascade)

  @@unique([ownerUserId, recurringItemId, transactionId])
  @@index([ownerUserId, transactionId])
  @@map("recurring_transaction_links")
}
```

- [ ] **Step 4: Create migration SQL**

Create `supabase/migrations/0005_debt_recurring_core.sql` with tables, indexes, triggers, and owner policies matching the Prisma model names above. Use `numeric(14,2)` for money, `numeric(7,4)` for APR, `date` for date-only fields, `text` for enum-like values, and `owner_user_id = auth.uid()` for every RLS policy.

- [ ] **Step 5: Generate Prisma client**

Run:

```bash
cd budgie-smuggler-app && npm run prisma:generate
```

Expected output includes:

```text
Generated Prisma Client
```

- [ ] **Step 6: Commit**

Run:

```bash
git add budgie-smuggler-app/prisma/schema.prisma budgie-smuggler-app/supabase/migrations/0005_debt_recurring_core.sql budgie-smuggler-app/src/lib/money-control/constants.ts budgie-smuggler-app/package-lock.json
git commit -m "feat: add debt and recurring data model"
```

Expected: commit succeeds.

---

### Task 3: Debt Calculation And Action Rules

**Files:**
- Create: `budgie-smuggler-app/src/lib/debt/calculations.ts`
- Create: `budgie-smuggler-app/src/lib/debt/calculations.test.ts`
- Create: `budgie-smuggler-app/src/lib/debt/actions.ts`
- Create: `budgie-smuggler-app/src/lib/debt/actions.test.ts`

- [ ] **Step 1: Write debt calculation tests**

Create tests covering:

```ts
expect(calculateUtilization({ balance: 820, creditLimit: 1000 })).toBe(82);
expect(estimateMonthlyInterest({ balance: 1200, apr: 29.99 })).toBeCloseTo(29.99, 2);
expect(getDebtPressure({ balance: 2000, apr: null, minimumPayment: 80, nextDueDate: null }).label).toBe("missing_info");
expect(getDebtPressure({ balance: 2000, apr: 32, minimumPayment: 40, nextDueDate: addDays(new Date(), 3) }).label).toBe("urgent");
expect(rankPayoffCandidates([{ id: "a", apr: 18, balance: 100 }, { id: "b", apr: 29.99, balance: 500 }])[0].id).toBe("b");
```

- [ ] **Step 2: Implement debt calculations**

Create functions with these signatures:

```ts
export type DebtMathInput = {
  id?: string;
  name?: string;
  balance: number;
  apr: number | null;
  minimumPayment: number | null;
  nextDueDate?: Date | string | null;
  creditLimit?: number | null;
};

export function calculateUtilization(input: Pick<DebtMathInput, "balance" | "creditLimit">): number | null;
export function estimateMonthlyInterest(input: Pick<DebtMathInput, "balance" | "apr">): number | null;
export function getDebtPressure(input: DebtMathInput): { label: "missing_info" | "urgent" | "high" | "normal"; reasons: string[] };
export function rankPayoffCandidates<T extends DebtMathInput>(debts: T[]): T[];
```

Rules:
- Utilization returns `null` when `creditLimit` is missing or zero.
- Utilization rounds to nearest whole percent.
- Monthly interest is `balance * (apr / 100 / 12)` rounded to cents.
- Missing APR or minimum payment produces `missing_info`.
- Due within seven days with balance above zero produces `urgent`.
- APR >= 25 or utilization >= 80 produces `high`.
- Payoff ranking sorts highest APR first and ignores rows without APR.

- [ ] **Step 3: Write debt action tests**

Create tests for:

```ts
const actions = buildDebtActionItems("user-id", [
  { id: "d1", name: "Visa", balance: 900, apr: null, minimumPayment: 35, nextDueDate: null, creditLimit: 1000 },
  { id: "d2", name: "Amex", balance: 820, apr: 29.99, minimumPayment: 50, nextDueDate: addDays(new Date(), 5), creditLimit: 1000 },
]);
expect(actions.map((item) => item.type)).toContain("complete_debt_details");
expect(actions.map((item) => item.type)).toContain("upcoming_debt_due");
expect(actions.map((item) => item.type)).toContain("high_utilization_debt");
expect(actions.map((item) => item.type)).toContain("debt_interest_pressure");
```

- [ ] **Step 4: Implement debt action builder**

Create:

```ts
export function buildDebtActionItems(userId: string, debts: DebtActionInput[]): ActionItemInput[];
```

Use stable action types and related entity metadata:
- missing APR/minimum/payment due date: `complete_debt_details`, priority `urgent`
- due within seven days: `upcoming_debt_due`, priority `urgent`
- utilization >= 80: `high_utilization_debt`, priority `high`
- APR >= 25 and monthly interest >= 10: `debt_interest_pressure`, priority `high`

- [ ] **Step 5: Run tests**

Run:

```bash
cd budgie-smuggler-app && npm test -- src/lib/debt
```

Expected: all debt tests pass.

- [ ] **Step 6: Commit**

Run:

```bash
git add budgie-smuggler-app/src/lib/debt
git commit -m "feat: add debt pressure rules"
```

Expected: commit succeeds.

---

### Task 4: Recurring Detection And Action Rules

**Files:**
- Create: `budgie-smuggler-app/src/lib/recurring/detection.ts`
- Create: `budgie-smuggler-app/src/lib/recurring/detection.test.ts`
- Create: `budgie-smuggler-app/src/lib/recurring/actions.ts`
- Create: `budgie-smuggler-app/src/lib/recurring/actions.test.ts`

- [ ] **Step 1: Write recurring detection tests**

Create tests proving:
- Three Netflix transactions 30 days apart become one monthly suspected item.
- Four weekly software charges become one weekly item.
- A latest charge at least 10% and `$2` above the prior typical amount sets `priceIncreaseDetected`.
- A single transaction for a merchant produces no recurring item.
- Transactions with direction `credit` produce no recurring item.

- [ ] **Step 2: Implement recurring detection**

Create:

```ts
export type RecurringDetectionTransaction = {
  id: string;
  postedDate: Date | string;
  merchantName: string | null;
  description: string | null;
  amount: number;
  direction: string;
  usageType: string;
  categoryId?: string | null;
};

export type DetectedRecurringItem = {
  merchantName: string;
  normalizedMerchantKey: string;
  usageType: string;
  categoryId: string | null;
  amountMin: number;
  amountMax: number;
  typicalAmount: number;
  cadence: "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly" | "unknown";
  nextExpectedDate: Date | null;
  lastSeenDate: Date;
  transactionCount: number;
  status: "suspected";
  priceIncreaseDetected: boolean;
  increaseAmount: number | null;
  transactionIds: string[];
};

export function normalizeMerchantKey(value: string): string;
export function detectRecurringItems(transactions: RecurringDetectionTransaction[]): DetectedRecurringItem[];
```

Cadence windows:
- weekly: 6-8 days
- biweekly: 13-15 days
- monthly: 27-35 days
- quarterly: 80-100 days
- yearly: 350-380 days

Amount stability:
- Same merchant requires at least two debit transactions.
- Amount range must be within max of `$5` or `15%` of typical amount.
- Price increase is true when latest amount exceeds prior typical by at least `10%` and `$2`.

- [ ] **Step 3: Write recurring action tests**

Create tests proving:
- suspected rows create `review_suspected_recurring`
- price increases create `review_price_increase`
- mixed or unknown usage creates `review_cross_usage_recurring`

- [ ] **Step 4: Implement recurring action builder**

Create:

```ts
export function buildRecurringActionItems(userId: string, items: RecurringActionInput[]): ActionItemInput[];
```

Rules:
- `status === "suspected"` creates a normal-priority review action.
- `priceIncreaseDetected` creates a high-priority price increase action.
- `usageType === "mixed" || usageType === "unknown"` creates a normal-priority usage review action.

- [ ] **Step 5: Run tests**

Run:

```bash
cd budgie-smuggler-app && npm test -- src/lib/recurring
```

Expected: all recurring tests pass.

- [ ] **Step 6: Commit**

Run:

```bash
git add budgie-smuggler-app/src/lib/recurring
git commit -m "feat: detect recurring charges"
```

Expected: commit succeeds.

---

### Task 5: Database Services And Action Item Updates

**Files:**
- Create: `budgie-smuggler-app/src/lib/debt/service.ts`
- Create: `budgie-smuggler-app/src/lib/recurring/service.ts`
- Modify: `budgie-smuggler-app/src/lib/action-items.ts`
- Modify: `budgie-smuggler-app/src/lib/today.ts`
- Modify: `budgie-smuggler-app/src/lib/server-data.ts`

- [ ] **Step 1: Add action item status helpers**

In `action-items.ts`, add:

```ts
export async function updateActionItemStatus(
  userId: string,
  id: string,
  status: "open" | "snoozed" | "done" | "dismissed",
  dueDate?: Date | null,
) {
  if (!prisma) {
    return { ok: true, source: "mock" as const };
  }

  const row = await prisma.actionItem.updateMany({
    where: { id, ownerUserId: userId },
    data: { status, dueDate: dueDate ?? undefined },
  });

  return { ok: row.count > 0, source: "database" as const };
}
```

Also update `createActionItems` so it skips duplicates by checking open items with the same `ownerUserId`, `type`, `relatedEntityType`, and `relatedEntityId` before calling `createMany`.

- [ ] **Step 2: Implement debt service**

Create service functions:

```ts
export async function listDebtAccounts(userId: string): Promise<DebtAccountView[]>;
export async function createDebtAccount(userId: string, input: DebtAccountWriteInput): Promise<DebtAccountView>;
export async function updateDebtAccount(userId: string, id: string, input: Partial<DebtAccountWriteInput>): Promise<DebtAccountView | null>;
export async function deleteDebtAccount(userId: string, id: string): Promise<boolean>;
export async function summarizeDebt(userId: string): Promise<DebtSummary>;
export async function refreshDebtActionItems(userId: string): Promise<{ created: number; source: "database" | "mock" }>;
```

Map Prisma decimals to numbers and include calculated fields:
- `utilization`
- `estimatedMonthlyInterest`
- `pressureLabel`
- `pressureReasons`

- [ ] **Step 3: Implement recurring service**

Create service functions:

```ts
export async function listRecurringItems(userId: string): Promise<RecurringItemView[]>;
export async function updateRecurringItem(userId: string, id: string, input: RecurringItemUpdateInput): Promise<RecurringItemView | null>;
export async function scanRecurringItems(userId: string): Promise<{ scanned: number; detected: number; source: "database" | "mock" }>;
export async function refreshRecurringActionItems(userId: string): Promise<{ created: number; source: "database" | "mock" }>;
```

`scanRecurringItems` should:
- Load accepted debit transactions ordered by date.
- Call `detectRecurringItems`.
- Upsert by `[ownerUserId, normalizedMerchantKey, cadence]`.
- Preserve `confirmed`, `ignored`, and `cancelled` statuses when an existing item is found.
- Create missing `RecurringTransactionLink` rows with `skipDuplicates: true`.
- Refresh recurring action items after upserts.

- [ ] **Step 4: Update Today data**

In `today.ts`, call:

```ts
await Promise.all([refreshDebtActionItems(userId), refreshRecurringActionItems(userId)]);
```

before `getOpenActionItems(userId, 10)`.

Also replace `missingDebtDetails: 0` with the count of debt rows where APR, minimum payment, or due date is missing.

- [ ] **Step 5: Add page data helpers**

In `server-data.ts`, add:

```ts
export async function getDebtPageData(userId: string) {
  const [accounts, summary] = await Promise.all([listDebtAccounts(userId), summarizeDebt(userId)]);
  return { accounts, summary, source: prisma ? ("database" as const) : ("mock" as const) };
}

export async function getRecurringPageData(userId: string) {
  const items = await listRecurringItems(userId);
  return { items, source: prisma ? ("database" as const) : ("mock" as const) };
}
```

- [ ] **Step 6: Run targeted tests**

Run:

```bash
cd budgie-smuggler-app && npm test -- src/lib/debt src/lib/recurring
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

Run:

```bash
git add budgie-smuggler-app/src/lib/debt budgie-smuggler-app/src/lib/recurring budgie-smuggler-app/src/lib/action-items.ts budgie-smuggler-app/src/lib/today.ts budgie-smuggler-app/src/lib/server-data.ts
git commit -m "feat: wire debt and recurring services"
```

Expected: commit succeeds.

---

### Task 6: API Routes

**Files:**
- Create: `budgie-smuggler-app/src/app/api/debt-accounts/route.ts`
- Create: `budgie-smuggler-app/src/app/api/debt-accounts/[id]/route.ts`
- Create: `budgie-smuggler-app/src/app/api/recurring-items/route.ts`
- Create: `budgie-smuggler-app/src/app/api/recurring-items/[id]/route.ts`
- Create: `budgie-smuggler-app/src/app/api/recurring-items/scan/route.ts`
- Create: `budgie-smuggler-app/src/app/api/action-items/[id]/route.ts`

- [ ] **Step 1: Add Zod schemas**

Use these validation rules in API routes:
- Debt name required, max 120.
- Debt balance required finite number.
- APR, minimum payment, credit limit, promo APR, last payment amount, last statement balance optional finite numbers.
- Due/statement days must be integers 1-31.
- Dates must be ISO date strings when provided.
- Recurring status must be `suspected`, `confirmed`, `ignored`, or `cancelled`.
- Action status must be `open`, `snoozed`, `done`, or `dismissed`.

- [ ] **Step 2: Implement debt collection route**

`GET` returns:

```ts
{ accounts, summary, source }
```

`POST` validates JSON, calls `createDebtAccount`, calls `refreshDebtActionItems`, and returns:

```ts
{ account, source }
```

- [ ] **Step 3: Implement debt item route**

`PATCH` validates JSON, calls `updateDebtAccount`, refreshes debt actions, and returns `404` when the owner-scoped row is missing.

`DELETE` calls `deleteDebtAccount`, refreshes debt actions, and returns:

```ts
{ ok: true, source }
```

- [ ] **Step 4: Implement recurring routes**

`GET /api/recurring-items` returns `{ items, source }`.

`PATCH /api/recurring-items/[id]` allows status, usage type, category ID, and notes changes, then refreshes recurring actions.

`POST /api/recurring-items/scan` runs `scanRecurringItems` and returns `{ scanned, detected, source }`.

- [ ] **Step 5: Implement action status route**

`PATCH /api/action-items/[id]` validates:

```ts
{ "status": "done" | "dismissed" | "open" | "snoozed", "dueDate": "2026-07-14" }
```

When status is `snoozed`, require `dueDate`. For other statuses, `dueDate` is optional.

- [ ] **Step 6: Run typecheck**

Run:

```bash
cd budgie-smuggler-app && rm -rf .next && npm run typecheck
```

Expected: command exits with code `0`.

- [ ] **Step 7: Commit**

Run:

```bash
git add budgie-smuggler-app/src/app/api budgie-smuggler-app/src/lib/debt budgie-smuggler-app/src/lib/recurring budgie-smuggler-app/src/lib/action-items.ts
git commit -m "feat: add debt and recurring APIs"
```

Expected: commit succeeds.

---

### Task 7: Debt And Recurring UI

**Files:**
- Create: `budgie-smuggler-app/src/app/(app)/debt/page.tsx`
- Create: `budgie-smuggler-app/src/app/(app)/recurring/page.tsx`
- Create: `budgie-smuggler-app/src/components/debt/debt-console.tsx`
- Create: `budgie-smuggler-app/src/components/recurring/recurring-console.tsx`
- Modify: `budgie-smuggler-app/src/components/today/action-inbox.tsx`
- Modify: `budgie-smuggler-app/src/components/today/reality-summary.tsx`
- Modify: `budgie-smuggler-app/src/lib/constants.ts`

- [ ] **Step 1: Add nav items**

In `src/lib/constants.ts`, insert:

```ts
  { href: "/debt", label: "Debt" },
  { href: "/recurring", label: "Recurring" },
```

after `/today`.

- [ ] **Step 2: Build Debt page**

`/debt` must show:
- total debt balance
- estimated monthly interest
- number of missing-detail accounts
- highest APR payoff target
- debt table/cards with utilization, APR, minimum payment, due date, usage type, and pressure label
- create/edit form with all fields from the spec

Use direct copy for blunt warnings:
- "APR missing. You are flying blind on this debt."
- "Minimum payment missing. This card cannot be managed correctly yet."
- "Over 80% utilized. Stop using this card unless survival requires it."

- [ ] **Step 3: Build Recurring page**

`/recurring` must show:
- scan button
- counts for suspected, confirmed, ignored/cancelled
- monthly estimate from confirmed and suspected recurring items
- recurring table/cards with merchant, amount range, cadence, next expected date, status, usage type, and price increase warning
- buttons for confirm, ignore, cancel, mark personal, mark business, mark mixed

Use direct copy for blunt warnings:
- "Suspected recurring charge. Confirm it or kill the noise."
- "Price increased. Decide if it still earns its place."
- "Usage unknown. Personal vs business matters here."

- [ ] **Step 4: Add Today action controls**

In `ActionInbox`, add buttons for:
- done
- dismiss
- snooze one week

Buttons call `/api/action-items/[id]` and then `router.refresh()`.

- [ ] **Step 5: Run typecheck**

Run:

```bash
cd budgie-smuggler-app && rm -rf .next && npm run typecheck
```

Expected: command exits with code `0`.

- [ ] **Step 6: Commit**

Run:

```bash
git add 'budgie-smuggler-app/src/app/(app)/debt' 'budgie-smuggler-app/src/app/(app)/recurring' budgie-smuggler-app/src/components/debt budgie-smuggler-app/src/components/recurring budgie-smuggler-app/src/components/today budgie-smuggler-app/src/lib/constants.ts
git commit -m "feat: add debt and recurring consoles"
```

Expected: commit succeeds.

---

### Task 8: README And Full Verification

**Files:**
- Modify: `budgie-smuggler-app/README.md`

- [ ] **Step 1: Document the slice**

Add a short section:

```md
## Debt and recurring control

- `/debt` stores credit cards, loans, APRs, minimum payments, due dates, credit limits, and usage type.
- `/recurring` scans accepted debit transactions for subscriptions and recurring charges.
- `/today` shows in-app action items for missing debt details, upcoming card payments, high utilization, interest pressure, suspected subscriptions, price increases, and unclear personal/business usage.
- This slice does not send push, SMS, or email reminders yet. It creates persistent in-app action items.
```

- [ ] **Step 2: Run unit tests**

Run:

```bash
cd budgie-smuggler-app && npm test
```

Expected: all Vitest suites pass.

- [ ] **Step 3: Run typecheck**

Run:

```bash
cd budgie-smuggler-app && rm -rf .next && npm run typecheck
```

Expected: command exits with code `0`.

- [ ] **Step 4: Run lint**

Run:

```bash
cd budgie-smuggler-app && npm run lint
```

Expected: command exits with code `0`.

- [ ] **Step 5: Run build**

Run:

```bash
cd budgie-smuggler-app && npm run build
```

Expected: production build completes successfully.

- [ ] **Step 6: Commit docs**

Run:

```bash
git add budgie-smuggler-app/README.md
git commit -m "docs: document debt and recurring controls"
```

Expected: commit succeeds if README changed.

- [ ] **Step 7: Review diff**

Run:

```bash
git status --short
git log --oneline --decorate --max-count=8
```

Expected:
- `git status --short` prints nothing.
- Log shows the Debt Recurring Core commits on branch `debt-recurring-core`.

---

## Self-Review

- Spec coverage: Debt data model, APR/minimum/due/credit-limit fields, utilization, monthly interest, payoff priority, recurring detection, statuses, price increases, personal/business usage, Today actions, `/debt`, `/recurring`, APIs, services, and tests are covered. PDF import, AI chat, Grok brief, external reminder delivery, and full reports are intentionally excluded because they are later slices.
- Placeholder scan: The plan avoids deferred implementation language and gives concrete file paths, commands, validation rules, function names, and expected outputs. The migration SQL step specifies exact table/model parity and policy rules instead of leaving the database shape open.
- Type consistency: Function names used by API/UI tasks match the service and pure-module tasks: `listDebtAccounts`, `summarizeDebt`, `refreshDebtActionItems`, `listRecurringItems`, `scanRecurringItems`, `refreshRecurringActionItems`, and `updateActionItemStatus`.
