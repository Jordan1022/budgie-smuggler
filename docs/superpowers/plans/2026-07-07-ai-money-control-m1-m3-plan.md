# AI Money Control M1-M3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first useful slice of Budgie Smuggler's AI-assisted money control system: manual accounts, CSV import, reviewable imported transactions, Today action items, and Grok-backed classification suggestions.

**Architecture:** Extend the existing Prisma/Supabase-backed Next.js app instead of starting a new app. Reuse `bank_accounts` as the unified account table by making Plaid fields nullable and adding source/usage metadata, then layer import batches, imported transaction staging, action items, and AI audit records on top. Keep pure parsing/classification utilities in `src/lib` with Vitest coverage, and keep API routes thin.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma, Supabase Postgres/RLS, Vitest, Zod, xAI REST API through `fetch` with model `grok-4.3` configurable by `XAI_MODEL`.

---

## Scope Decisions

- First slice supports CSV uploads only. PDF workflows are represented in nullable schema fields but not implemented.
- Manual and Plaid accounts share `bank_accounts` because existing transactions already reference that table.
- Raw CSV files are not persisted in the first slice. Store filename, file hash, imported row metadata, and parse results. Add nullable storage path columns so file storage can be added without another model split.
- `Today` is a new `/today` route and becomes the first nav item. Existing `/dashboard` remains available.
- Reminders are stored as action items only. Email/push delivery is outside this first slice.
- Grok classification is available only when `XAI_API_KEY` is configured. Without it, API routes return deterministic, reviewable fallback suggestions.
- The xAI provider is wrapped in `src/lib/ai/grok.ts` so the app can switch providers without changing import/review logic.

## File Structure

- Modify `budgie-smuggler-app/prisma/schema.prisma`
  - Make Plaid-only account fields nullable.
  - Add account source and personal/business usage fields.
  - Add transaction source, usage, role, review, and confidence fields.
  - Add `ImportBatch`, `ImportedTransaction`, `ActionItem`, `AiRun`, and `AiFinding`.
- Create `budgie-smuggler-app/supabase/migrations/0004_manual_imports_ai_actions.sql`
  - Mirror Prisma changes.
  - Enable RLS and owner policies on new tables.
- Modify `budgie-smuggler-app/src/lib/env.ts`
  - Add `XAI_API_KEY` and `XAI_MODEL`.
- Create `budgie-smuggler-app/src/lib/money-control/constants.ts`
  - Central enum-like constants for source type, usage type, cash-flow role, review status, action status, and AI purpose.
- Create `budgie-smuggler-app/src/lib/imports/csv.ts`
  - Parse CSV text into normalized rows.
- Create `budgie-smuggler-app/src/lib/imports/csv.test.ts`
  - Cover quoted CSV, amount columns, debit/credit split columns, and date/description mapping.
- Create `budgie-smuggler-app/src/lib/imports/normalize.ts`
  - Normalize amounts, directions, merchant keys, and duplicate fingerprints.
- Create `budgie-smuggler-app/src/lib/imports/normalize.test.ts`
  - Cover direction/amount and duplicate fingerprint behavior.
- Create `budgie-smuggler-app/src/lib/imports/service.ts`
  - Create manual accounts, import batches, imported transactions, duplicate flags, and import-related action items.
- Create `budgie-smuggler-app/src/lib/imports/service.test.ts`
  - Test import preparation without Prisma by exercising pure planning helpers exported from the service.
- Create `budgie-smuggler-app/src/lib/action-items.ts`
  - Read and create action items for the Today page and import flows.
- Create `budgie-smuggler-app/src/lib/today.ts`
  - Build Today summary from action items, imported transaction counts, monthly cash flow, and source mode.
- Create `budgie-smuggler-app/src/lib/ai/schemas.ts`
  - Zod schemas for Grok classification output.
- Create `budgie-smuggler-app/src/lib/ai/redaction.ts`
  - Redact account numbers, long digit runs, and internal IDs before AI calls.
- Create `budgie-smuggler-app/src/lib/ai/redaction.test.ts`
  - Verify sensitive values are removed while dates, amounts, account nicknames, and merchant text remain useful.
- Create `budgie-smuggler-app/src/lib/ai/grok.ts`
  - xAI REST call wrapper with structured output parsing and fallback behavior.
- Create `budgie-smuggler-app/src/app/api/imports/route.ts`
  - `POST` accepts CSV `FormData`, creates import batch and staged rows.
  - `GET` lists recent import batches.
- Create `budgie-smuggler-app/src/app/api/imported-transactions/route.ts`
  - `GET` lists staged rows needing review.
- Create `budgie-smuggler-app/src/app/api/imported-transactions/[id]/route.ts`
  - `PATCH` updates review fields.
- Create `budgie-smuggler-app/src/app/api/imported-transactions/[id]/accept/route.ts`
  - `POST` converts one staged row into a ledger transaction.
- Modify `budgie-smuggler-app/src/app/api/accounts/route.ts`
  - Add manual account `POST`.
  - Include manual/Plaid source and usage fields in `GET`.
- Create `budgie-smuggler-app/src/app/api/ai/import-classifications/route.ts`
  - Classifies staged rows through Grok or fallback suggestions.
- Create `budgie-smuggler-app/src/app/(app)/today/page.tsx`
  - Default action dashboard.
- Create `budgie-smuggler-app/src/app/(app)/import/page.tsx`
  - Manual account and CSV import workflow.
- Create `budgie-smuggler-app/src/app/(app)/review/page.tsx`
  - Review and accept staged transactions.
- Create `budgie-smuggler-app/src/components/today/action-inbox.tsx`
  - Compact action item list.
- Create `budgie-smuggler-app/src/components/today/reality-summary.tsx`
  - Blunt financial reality cards.
- Create `budgie-smuggler-app/src/components/import/import-upload-form.tsx`
  - Client form for account creation and CSV upload.
- Create `budgie-smuggler-app/src/components/review/import-review-table.tsx`
  - Client review/accept table.
- Modify `budgie-smuggler-app/src/lib/server-data.ts`
  - Add getters for accounts, import batches, staged transactions, and Today data.
- Modify `budgie-smuggler-app/src/lib/constants.ts`
  - Add new nav items and keep labels short.
- Modify `budgie-smuggler-app/src/components/layout/mobile-nav.tsx`
  - Render a horizontally scrollable nav instead of a fixed five-column grid.
- Modify `budgie-smuggler-app/src/app/page.tsx`
  - Redirect authenticated app entry to `/today`.
- Modify `budgie-smuggler-app/README.md`
  - Document CSV imports and xAI env vars.

---

### Task 1: Schema, Migration, And Environment Foundation

**Files:**
- Modify: `budgie-smuggler-app/prisma/schema.prisma`
- Create: `budgie-smuggler-app/supabase/migrations/0004_manual_imports_ai_actions.sql`
- Modify: `budgie-smuggler-app/src/lib/env.ts`
- Create: `budgie-smuggler-app/src/lib/money-control/constants.ts`

- [ ] **Step 1: Add constants**

Create `src/lib/money-control/constants.ts`:

```ts
export const ACCOUNT_SOURCE_TYPES = ["plaid", "manual", "import"] as const;
export const USAGE_TYPES = ["personal", "business", "mixed", "unknown"] as const;
export const CASH_FLOW_ROLES = ["spending", "income", "transfer", "debt_payment", "interest", "fee", "refund", "other"] as const;
export const REVIEW_STATUSES = ["needs_review", "suggested", "confirmed", "accepted", "ignored"] as const;
export const ACTION_STATUSES = ["open", "snoozed", "done", "dismissed"] as const;
export const ACTION_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export const AI_PURPOSES = ["classification", "brief", "chat", "extraction"] as const;

export type AccountSourceType = (typeof ACCOUNT_SOURCE_TYPES)[number];
export type UsageType = (typeof USAGE_TYPES)[number];
export type CashFlowRole = (typeof CASH_FLOW_ROLES)[number];
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export type ActionStatus = (typeof ACTION_STATUSES)[number];
export type ActionPriority = (typeof ACTION_PRIORITIES)[number];
export type AiPurpose = (typeof AI_PURPOSES)[number];
```

- [ ] **Step 2: Update env schema**

In `src/lib/env.ts`, add these fields to `envSchema`:

```ts
  // xAI / Grok - optional (classification degrades gracefully)
  XAI_API_KEY: optional,
  XAI_MODEL: z.string().trim().optional().default("grok-4.3"),
```

Pass them through `envSchema.parse`:

```ts
    XAI_API_KEY: process.env.XAI_API_KEY,
    XAI_MODEL: process.env.XAI_MODEL,
```

Add this helper at the bottom:

```ts
export function isXaiConfigured() {
  return Boolean(env().XAI_API_KEY);
}
```

- [ ] **Step 3: Update Prisma schema**

Modify `BankAccount`:

```prisma
model BankAccount {
  id               String    @id @default(uuid()) @db.Uuid
  ownerUserId      String    @map("owner_user_id") @db.Uuid
  plaidItemRefId   String?   @map("plaid_item_ref_id") @db.Uuid
  plaidAccountId   String?   @unique @map("plaid_account_id")
  name             String
  mask             String?
  type             String?
  subtype          String?
  sourceType       String    @default("plaid") @map("source_type")
  usageType        String    @default("unknown") @map("usage_type")
  currentBalance   Decimal?  @db.Decimal(14, 2)
  availableBalance Decimal?  @db.Decimal(14, 2)
  lastBalanceAt    DateTime? @map("last_balance_at") @db.Timestamptz(6)
  lastImportedAt   DateTime? @map("last_imported_at") @db.Timestamptz(6)
  createdAt        DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)

  owner        Profile       @relation(fields: [ownerUserId], references: [id], onDelete: Cascade)
  plaidItem    PlaidItem?    @relation(fields: [plaidItemRefId], references: [id], onDelete: Cascade)
  transactions Transaction[]
  importBatches ImportBatch[]

  @@index([ownerUserId])
  @@map("bank_accounts")
}
```

Add fields to `Transaction`:

```prisma
  sourceType            String   @default("plaid") @map("source_type")
  sourceImportBatchId   String?  @map("source_import_batch_id") @db.Uuid
  usageType             String   @default("unknown") @map("usage_type")
  cashFlowRole          String   @default("spending") @map("cash_flow_role")
  reviewStatus          String   @default("accepted") @map("review_status")
  confidence            Decimal? @db.Decimal(5, 4)
  notes                 String?
```

Add models `ImportBatch`, `ImportedTransaction`, `ActionItem`, `AiRun`, and `AiFinding` exactly as used by the service layer:

```prisma
model ImportBatch {
  id                 String   @id @default(uuid()) @db.Uuid
  ownerUserId        String   @map("owner_user_id") @db.Uuid
  bankAccountId      String   @map("bank_account_id") @db.Uuid
  fileName           String   @map("file_name")
  fileType           String   @map("file_type")
  fileHash           String   @map("file_hash")
  parserStatus       String   @default("parsed") @map("parser_status")
  detectedStartDate  DateTime? @map("detected_start_date") @db.Date
  detectedEndDate    DateTime? @map("detected_end_date") @db.Date
  rawFileStoragePath String?  @map("raw_file_storage_path")
  extractedTextPath  String?  @map("extracted_text_path")
  redactionSummary   Json?    @map("redaction_summary")
  createdAt          DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  owner        Profile              @relation(fields: [ownerUserId], references: [id], onDelete: Cascade)
  bankAccount  BankAccount          @relation(fields: [bankAccountId], references: [id], onDelete: Cascade)
  transactions ImportedTransaction[]

  @@index([ownerUserId, createdAt])
  @@map("import_batches")
}

model ImportedTransaction {
  id                   String   @id @default(uuid()) @db.Uuid
  importBatchId        String   @map("import_batch_id") @db.Uuid
  ownerUserId          String   @map("owner_user_id") @db.Uuid
  bankAccountId        String   @map("bank_account_id") @db.Uuid
  rawDate              String?  @map("raw_date")
  parsedDate           DateTime @map("parsed_date") @db.Date
  rawDescription       String   @map("raw_description")
  normalizedDescription String  @map("normalized_description")
  amount               Decimal  @db.Decimal(14, 2)
  direction            String
  detectedCategory     String?  @map("detected_category")
  detectedUsageType    String   @default("unknown") @map("detected_usage_type")
  detectedCashFlowRole String   @default("spending") @map("detected_cash_flow_role")
  duplicateTransactionId String? @map("duplicate_transaction_id") @db.Uuid
  confidence           Decimal? @db.Decimal(5, 4)
  reviewStatus         String   @default("needs_review") @map("review_status")
  sourceRow            Json     @map("source_row")
  acceptedTransactionId String? @map("accepted_transaction_id") @db.Uuid
  createdAt            DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt            DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  importBatch ImportBatch @relation(fields: [importBatchId], references: [id], onDelete: Cascade)
  owner       Profile     @relation(fields: [ownerUserId], references: [id], onDelete: Cascade)
  bankAccount BankAccount @relation(fields: [bankAccountId], references: [id], onDelete: Cascade)

  @@index([ownerUserId, reviewStatus])
  @@index([ownerUserId, parsedDate])
  @@map("imported_transactions")
}

model ActionItem {
  id                String   @id @default(uuid()) @db.Uuid
  ownerUserId       String   @map("owner_user_id") @db.Uuid
  type              String
  title             String
  body              String?
  priority          String   @default("normal")
  dueDate           DateTime? @map("due_date") @db.Date
  status            String   @default("open")
  relatedEntityType String?  @map("related_entity_type")
  relatedEntityId   String?  @map("related_entity_id") @db.Uuid
  source            String   @default("system")
  createdAt         DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt         DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  owner Profile @relation(fields: [ownerUserId], references: [id], onDelete: Cascade)

  @@index([ownerUserId, status, priority])
  @@map("action_items")
}

model AiRun {
  id              String   @id @default(uuid()) @db.Uuid
  ownerUserId     String   @map("owner_user_id") @db.Uuid
  provider        String   @default("xai")
  model           String
  purpose         String
  redactionLevel  String   @map("redaction_level")
  promptVersion   String   @map("prompt_version")
  inputSummary    Json     @map("input_summary")
  outputStatus    String   @map("output_status")
  createdAt       DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  owner    Profile     @relation(fields: [ownerUserId], references: [id], onDelete: Cascade)
  findings AiFinding[]

  @@index([ownerUserId, createdAt])
  @@map("ai_runs")
}

model AiFinding {
  id                String   @id @default(uuid()) @db.Uuid
  aiRunId           String   @map("ai_run_id") @db.Uuid
  ownerUserId       String   @map("owner_user_id") @db.Uuid
  findingType       String   @map("finding_type")
  structuredOutput  Json     @map("structured_output")
  confidence        Decimal? @db.Decimal(5, 4)
  relatedEntityType String?  @map("related_entity_type")
  relatedEntityId   String?  @map("related_entity_id") @db.Uuid
  reviewStatus      String   @default("suggested") @map("review_status")
  createdAt         DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  aiRun AiRun   @relation(fields: [aiRunId], references: [id], onDelete: Cascade)
  owner Profile @relation(fields: [ownerUserId], references: [id], onDelete: Cascade)

  @@index([ownerUserId, reviewStatus])
  @@map("ai_findings")
}
```

Add relation arrays to `Profile`:

```prisma
  importBatches        ImportBatch[]
  importedTransactions ImportedTransaction[]
  actionItems          ActionItem[]
  aiRuns               AiRun[]
  aiFindings           AiFinding[]
```

- [ ] **Step 4: Add SQL migration**

Create `supabase/migrations/0004_manual_imports_ai_actions.sql` with SQL matching the Prisma changes. Include:

```sql
alter table public.bank_accounts
  alter column plaid_item_ref_id drop not null,
  alter column plaid_account_id drop not null,
  add column if not exists source_type text not null default 'plaid',
  add column if not exists usage_type text not null default 'unknown',
  add column if not exists last_imported_at timestamptz,
  add column if not exists created_at timestamptz not null default now();

alter table public.transactions
  add column if not exists source_type text not null default 'plaid',
  add column if not exists source_import_batch_id uuid,
  add column if not exists usage_type text not null default 'unknown',
  add column if not exists cash_flow_role text not null default 'spending',
  add column if not exists review_status text not null default 'accepted',
  add column if not exists confidence numeric(5,4),
  add column if not exists notes text;
```

Then create the five new tables, indexes, RLS enablement, and owner policies using the same policy pattern from `0001_initial.sql`.

- [ ] **Step 5: Validate Prisma**

Run:

```bash
npm run prisma:generate
npm run typecheck
```

Expected: Prisma client generation succeeds, and TypeScript errors only appear in files that have not been created yet if tasks are executed out of order. When executing this task in isolation, create the referenced relation fields before running `typecheck`.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma supabase/migrations/0004_manual_imports_ai_actions.sql src/lib/env.ts src/lib/money-control/constants.ts
git commit -m "feat: add manual import data model"
```

---

### Task 2: CSV Parsing And Import Normalization

**Files:**
- Create: `budgie-smuggler-app/src/lib/imports/csv.ts`
- Create: `budgie-smuggler-app/src/lib/imports/csv.test.ts`
- Create: `budgie-smuggler-app/src/lib/imports/normalize.ts`
- Create: `budgie-smuggler-app/src/lib/imports/normalize.test.ts`

- [ ] **Step 1: Write CSV parser tests**

Create `src/lib/imports/csv.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseCsvTransactions } from "@/lib/imports/csv";

describe("parseCsvTransactions", () => {
  it("parses a signed amount CSV", () => {
    const result = parseCsvTransactions("Date,Description,Amount\n2026-06-01,Kroger,-42.18\n2026-06-02,Payroll,1200.00");

    expect(result.rows).toEqual([
      expect.objectContaining({ rawDate: "2026-06-01", parsedDate: "2026-06-01", rawDescription: "Kroger", amount: 42.18, direction: "debit" }),
      expect.objectContaining({ rawDate: "2026-06-02", parsedDate: "2026-06-02", rawDescription: "Payroll", amount: 1200, direction: "credit" }),
    ]);
    expect(result.errors).toEqual([]);
  });

  it("parses split debit and credit columns", () => {
    const csv = "Posted Date,Payee,Debit,Credit\n07/01/2026,Netflix,22.99,\n07/02/2026,Client Payment,,500.00";
    const result = parseCsvTransactions(csv);

    expect(result.rows.map((row) => ({ amount: row.amount, direction: row.direction }))).toEqual([
      { amount: 22.99, direction: "debit" },
      { amount: 500, direction: "credit" },
    ]);
  });

  it("keeps quoted commas in descriptions", () => {
    const result = parseCsvTransactions("Date,Description,Amount\n2026-06-01,\"Amazon, Marketplace\",-19.99");

    expect(result.rows[0].rawDescription).toBe("Amazon, Marketplace");
  });

  it("reports rows that cannot be parsed", () => {
    const result = parseCsvTransactions("Date,Description,Amount\nbad-date,Kroger,-42.18");

    expect(result.rows).toEqual([]);
    expect(result.errors[0]).toContain("Row 2");
  });
});
```

- [ ] **Step 2: Run parser tests to verify failure**

Run:

```bash
npm test -- src/lib/imports/csv.test.ts
```

Expected: FAIL because `@/lib/imports/csv` does not exist.

- [ ] **Step 3: Implement CSV parser**

Create `src/lib/imports/csv.ts` with exported types:

```ts
export type ParsedCsvTransaction = {
  rawDate: string;
  parsedDate: string;
  rawDescription: string;
  normalizedDescription: string;
  amount: number;
  direction: "debit" | "credit";
  sourceRow: Record<string, string>;
};

export type CsvParseResult = {
  rows: ParsedCsvTransaction[];
  errors: string[];
};
```

Implement:

```ts
export function parseCsvTransactions(csvText: string): CsvParseResult
```

Rules:

- Parse quoted fields with doubled quote escaping.
- Normalize headers by lowercasing and removing spaces, underscores, and hyphens.
- Date headers: `date`, `posteddate`, `postdate`, `transactiondate`.
- Description headers: `description`, `merchant`, `name`, `payee`, `memo`.
- Amount header: `amount`.
- Split columns: debit headers `debit`, `withdrawal`, `charge`; credit headers `credit`, `deposit`, `payment`.
- A negative signed amount is a debit. A positive signed amount is a credit.
- Split debit values are debit. Split credit values are credit.
- Store absolute amount rounded to cents.
- Normalize dates to `YYYY-MM-DD`.

- [ ] **Step 4: Write normalization tests**

Create `src/lib/imports/normalize.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildDuplicateFingerprint, normalizeMerchantKey, normalizeSignedAmount } from "@/lib/imports/normalize";

describe("import normalization", () => {
  it("normalizes signed amounts", () => {
    expect(normalizeSignedAmount("-42.187")).toEqual({ amount: 42.19, direction: "debit" });
    expect(normalizeSignedAmount("1200")).toEqual({ amount: 1200, direction: "credit" });
  });

  it("builds stable merchant keys", () => {
    expect(normalizeMerchantKey("Amazon Marketplace #123")).toBe("amazon marketplace");
  });

  it("builds duplicate fingerprints from account, date, amount, direction, and merchant", () => {
    expect(
      buildDuplicateFingerprint({
        bankAccountId: "acct-1",
        parsedDate: "2026-06-01",
        amount: 42.18,
        direction: "debit",
        normalizedDescription: "Kroger",
      }),
    ).toBe("acct-1|2026-06-01|debit|42.18|kroger");
  });
});
```

- [ ] **Step 5: Implement normalization helpers**

Create `src/lib/imports/normalize.ts` with:

```ts
export function roundToCents(value: number) {
  return Math.round(value * 100) / 100;
}

export function normalizeSignedAmount(input: string | number): { amount: number; direction: "debit" | "credit" } {
  const value = typeof input === "number" ? input : Number(String(input).replace(/[$,\s]/g, ""));
  if (!Number.isFinite(value)) {
    throw new Error("Amount is not a number.");
  }
  return {
    amount: roundToCents(Math.abs(value)),
    direction: value < 0 ? "debit" : "credit",
  };
}

export function normalizeMerchantKey(input: string) {
  return input
    .toLowerCase()
    .replace(/[#*][a-z0-9-]+/gi, " ")
    .replace(/\b\d{2,}\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function buildDuplicateFingerprint(input: {
  bankAccountId: string;
  parsedDate: string;
  amount: number;
  direction: string;
  normalizedDescription: string;
}) {
  return [
    input.bankAccountId,
    input.parsedDate,
    input.direction,
    input.amount.toFixed(2),
    normalizeMerchantKey(input.normalizedDescription),
  ].join("|");
}
```

- [ ] **Step 6: Run parser and normalization tests**

Run:

```bash
npm test -- src/lib/imports/csv.test.ts src/lib/imports/normalize.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/imports/csv.ts src/lib/imports/csv.test.ts src/lib/imports/normalize.ts src/lib/imports/normalize.test.ts
git commit -m "feat: parse imported transaction CSVs"
```

---

### Task 3: Import Persistence And Account APIs

**Files:**
- Create: `budgie-smuggler-app/src/lib/imports/service.ts`
- Create: `budgie-smuggler-app/src/lib/imports/service.test.ts`
- Create: `budgie-smuggler-app/src/lib/action-items.ts`
- Modify: `budgie-smuggler-app/src/lib/server-data.ts`
- Modify: `budgie-smuggler-app/src/app/api/accounts/route.ts`
- Create: `budgie-smuggler-app/src/app/api/imports/route.ts`

- [ ] **Step 1: Write service helper tests**

Create `src/lib/imports/service.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildImportActionItems, summarizeImportRows } from "@/lib/imports/service";

describe("import service helpers", () => {
  it("summarizes rows needing review", () => {
    const summary = summarizeImportRows([
      { reviewStatus: "needs_review", duplicateTransactionId: null },
      { reviewStatus: "needs_review", duplicateTransactionId: "txn-1" },
      { reviewStatus: "suggested", duplicateTransactionId: null },
    ]);

    expect(summary).toEqual({ total: 3, needsReview: 2, duplicateCandidates: 1, suggested: 1 });
  });

  it("creates concrete action items for imported rows", () => {
    const items = buildImportActionItems({
      importBatchId: "batch-1",
      totalRows: 12,
      needsReview: 5,
      duplicateCandidates: 2,
    });

    expect(items).toEqual([
      expect.objectContaining({
        type: "review_import",
        title: "Review 5 imported transactions",
        priority: "high",
        relatedEntityType: "import_batch",
        relatedEntityId: "batch-1",
      }),
      expect.objectContaining({
        type: "check_duplicates",
        title: "Check 2 possible duplicate transactions",
        priority: "normal",
      }),
    ]);
  });
});
```

- [ ] **Step 2: Run service tests to verify failure**

Run:

```bash
npm test -- src/lib/imports/service.test.ts
```

Expected: FAIL because the service file does not exist.

- [ ] **Step 3: Implement action item helpers**

Create `src/lib/action-items.ts` with:

```ts
import { prisma } from "@/lib/prisma";

export type ActionItemInput = {
  type: string;
  title: string;
  body?: string | null;
  priority?: "low" | "normal" | "high" | "urgent";
  dueDate?: Date | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  source?: "system" | "rule" | "ai";
};

export async function createActionItems(userId: string, items: ActionItemInput[]) {
  if (!prisma || items.length === 0) {
    return { created: 0, source: prisma ? "database" as const : "mock" as const };
  }

  await prisma.actionItem.createMany({
    data: items.map((item) => ({
      ownerUserId: userId,
      type: item.type,
      title: item.title,
      body: item.body ?? null,
      priority: item.priority ?? "normal",
      dueDate: item.dueDate ?? null,
      relatedEntityType: item.relatedEntityType ?? null,
      relatedEntityId: item.relatedEntityId ?? null,
      source: item.source ?? "system",
    })),
    skipDuplicates: false,
  });

  return { created: items.length, source: "database" as const };
}

export async function getOpenActionItems(userId: string, limit = 20) {
  if (!prisma) {
    return [
      {
        id: "mock-import-review",
        type: "review_import",
        title: "Review 8 imported transactions",
        body: "Sample mode shows what the money inbox will look like.",
        priority: "high",
        dueDate: null,
        relatedEntityType: "import_batch",
        relatedEntityId: null,
        source: "system",
        createdAt: new Date().toISOString(),
      },
    ];
  }

  const rows = await prisma.actionItem.findMany({
    where: { ownerUserId: userId, status: "open" },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: limit,
  });

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    priority: row.priority,
    dueDate: row.dueDate?.toISOString().slice(0, 10) ?? null,
    relatedEntityType: row.relatedEntityType,
    relatedEntityId: row.relatedEntityId,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
  }));
}
```

- [ ] **Step 4: Implement import service**

Create `src/lib/imports/service.ts` with:

```ts
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { parseCsvTransactions, type ParsedCsvTransaction } from "@/lib/imports/csv";
import { buildDuplicateFingerprint } from "@/lib/imports/normalize";
import { createActionItems, type ActionItemInput } from "@/lib/action-items";

export function summarizeImportRows(rows: { reviewStatus: string; duplicateTransactionId?: string | null }[]) {
  return {
    total: rows.length,
    needsReview: rows.filter((row) => row.reviewStatus === "needs_review").length,
    duplicateCandidates: rows.filter((row) => row.duplicateTransactionId).length,
    suggested: rows.filter((row) => row.reviewStatus === "suggested").length,
  };
}

export function buildImportActionItems(input: {
  importBatchId: string;
  totalRows: number;
  needsReview: number;
  duplicateCandidates: number;
}): ActionItemInput[] {
  const items: ActionItemInput[] = [];
  if (input.needsReview > 0) {
    items.push({
      type: "review_import",
      title: `Review ${input.needsReview} imported transactions`,
      body: `${input.totalRows} transactions were imported. Confirm the unclear rows before reports count them as reliable.`,
      priority: "high",
      relatedEntityType: "import_batch",
      relatedEntityId: input.importBatchId,
      source: "system",
    });
  }
  if (input.duplicateCandidates > 0) {
    items.push({
      type: "check_duplicates",
      title: `Check ${input.duplicateCandidates} possible duplicate transactions`,
      body: "These look like transactions already in the ledger. Confirm before accepting them.",
      priority: "normal",
      relatedEntityType: "import_batch",
      relatedEntityId: input.importBatchId,
      source: "system",
    });
  }
  return items;
}

export async function importCsvForAccount(input: {
  userId: string;
  bankAccountId: string;
  fileName: string;
  csvText: string;
}) {
  if (!prisma) {
    const parsed = parseCsvTransactions(input.csvText);
    return { source: "mock" as const, importBatchId: "mock-import", parsed, summary: summarizeImportRows(parsed.rows.map(() => ({ reviewStatus: "needs_review" }))) };
  }

  const db = prisma;
  const account = await db.bankAccount.findFirst({ where: { id: input.bankAccountId, ownerUserId: input.userId } });
  if (!account) {
    throw new Error("Account not found.");
  }

  const parsed = parseCsvTransactions(input.csvText);
  if (parsed.rows.length === 0) {
    throw new Error(parsed.errors[0] ?? "No importable rows found.");
  }

  const fileHash = createHash("sha256").update(input.csvText).digest("hex");
  const parsedDates = parsed.rows.map((row) => row.parsedDate).sort();

  const result = await db.$transaction(async (tx) => {
    const batch = await tx.importBatch.create({
      data: {
        ownerUserId: input.userId,
        bankAccountId: input.bankAccountId,
        fileName: input.fileName,
        fileType: "csv",
        fileHash,
        parserStatus: "parsed",
        detectedStartDate: new Date(parsedDates[0]),
        detectedEndDate: new Date(parsedDates[parsedDates.length - 1]),
      },
    });

    const existing = await tx.transaction.findMany({
      where: {
        ownerUserId: input.userId,
        bankAccountId: input.bankAccountId,
        postedDate: { in: parsed.rows.map((row) => new Date(row.parsedDate)) },
      },
      select: { id: true, postedDate: true, amount: true, direction: true, description: true, merchantName: true },
    });

    const existingByFingerprint = new Map(
      existing.map((txn) => [
        buildDuplicateFingerprint({
          bankAccountId: input.bankAccountId,
          parsedDate: txn.postedDate.toISOString().slice(0, 10),
          amount: Number(txn.amount),
          direction: txn.direction,
          normalizedDescription: txn.merchantName ?? txn.description ?? "",
        }),
        txn.id,
      ]),
    );

    const staged = await Promise.all(parsed.rows.map((row: ParsedCsvTransaction) => {
      const duplicateTransactionId = existingByFingerprint.get(buildDuplicateFingerprint({ bankAccountId: input.bankAccountId, ...row })) ?? null;
      return tx.importedTransaction.create({
        data: {
          importBatchId: batch.id,
          ownerUserId: input.userId,
          bankAccountId: input.bankAccountId,
          rawDate: row.rawDate,
          parsedDate: new Date(row.parsedDate),
          rawDescription: row.rawDescription,
          normalizedDescription: row.normalizedDescription,
          amount: row.amount,
          direction: row.direction,
          detectedUsageType: account.usageType,
          detectedCashFlowRole: row.direction === "credit" ? "income" : "spending",
          duplicateTransactionId,
          confidence: duplicateTransactionId ? 0.95 : 0.55,
          reviewStatus: duplicateTransactionId ? "needs_review" : "needs_review",
          sourceRow: row.sourceRow,
        },
      });
    }));

    await tx.bankAccount.update({
      where: { id: input.bankAccountId },
      data: { lastImportedAt: new Date(), sourceType: account.sourceType === "plaid" ? "plaid" : "manual" },
    });

    return { batch, staged };
  });

  const summary = summarizeImportRows(result.staged);
  await createActionItems(input.userId, buildImportActionItems({
    importBatchId: result.batch.id,
    totalRows: summary.total,
    needsReview: summary.needsReview,
    duplicateCandidates: summary.duplicateCandidates,
  }));

  return { source: "database" as const, importBatchId: result.batch.id, parsed, summary };
}
```

- [ ] **Step 5: Update account API**

Modify `src/app/api/accounts/route.ts` so `GET` includes `sourceType`, `usageType`, and `lastImportedAt`, and add `POST` with this Zod schema:

```ts
const createAccountSchema = z.object({
  name: z.string().trim().min(1).max(120),
  institutionName: z.string().trim().max(120).optional(),
  type: z.enum(["checking", "savings", "credit_card", "loan", "cash", "other"]).default("checking"),
  usageType: z.enum(["personal", "business", "mixed", "unknown"]).default("unknown"),
  currentBalance: z.number().finite().optional(),
});
```

The `POST` create data is:

```ts
{
  ownerUserId: user.id,
  name: parsed.data.name,
  type: parsed.data.type,
  usageType: parsed.data.usageType,
  sourceType: "manual",
  currentBalance: parsed.data.currentBalance ?? null,
  lastBalanceAt: parsed.data.currentBalance === undefined ? null : new Date(),
}
```

- [ ] **Step 6: Add import API**

Create `src/app/api/imports/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getRouteUser, unauthorized } from "@/lib/route-auth";
import { importCsvForAccount } from "@/lib/imports/service";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getRouteUser();
  if (!user) return unauthorized();
  if (!prisma) return NextResponse.json({ imports: [], source: "mock" });

  const rows = await prisma.importBatch.findMany({
    where: { ownerUserId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { bankAccount: true, _count: { select: { transactions: true } } },
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
  if (!user) return unauthorized();

  const formData = await request.formData();
  const bankAccountId = String(formData.get("bankAccountId") ?? "");
  const file = formData.get("file");
  if (!bankAccountId || !(file instanceof File)) {
    return NextResponse.json({ error: "bankAccountId and file are required." }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return NextResponse.json({ error: "Only CSV imports are supported in this version." }, { status: 400 });
  }

  const result = await importCsvForAccount({
    userId: user.id,
    bankAccountId,
    fileName: file.name,
    csvText: await file.text(),
  });

  return NextResponse.json(result);
}
```

- [ ] **Step 7: Run tests and typecheck**

Run:

```bash
npm test -- src/lib/imports/service.test.ts
npm run typecheck
```

Expected: PASS after dependent schema/client generation from Task 1.

- [ ] **Step 8: Commit**

```bash
git add src/lib/imports/service.ts src/lib/imports/service.test.ts src/lib/action-items.ts src/lib/server-data.ts src/app/api/accounts/route.ts src/app/api/imports/route.ts
git commit -m "feat: import CSV transactions into review queue"
```

---

### Task 4: Review Queue And Ledger Acceptance

**Files:**
- Create: `budgie-smuggler-app/src/app/api/imported-transactions/route.ts`
- Create: `budgie-smuggler-app/src/app/api/imported-transactions/[id]/route.ts`
- Create: `budgie-smuggler-app/src/app/api/imported-transactions/[id]/accept/route.ts`
- Create: `budgie-smuggler-app/src/components/review/import-review-table.tsx`
- Create: `budgie-smuggler-app/src/app/(app)/review/page.tsx`
- Modify: `budgie-smuggler-app/src/lib/server-data.ts`

- [ ] **Step 1: Add staged transaction getter**

Add to `src/lib/server-data.ts`:

```ts
export async function getImportedTransactionsForReview(userId: string) {
  if (!prisma) {
    return {
      source: "mock" as const,
      transactions: [
        {
          id: "mock-imported-1",
          parsedDate: "2026-06-01",
          rawDescription: "Amazon Marketplace",
          amount: 42.18,
          direction: "debit",
          detectedUsageType: "unknown",
          detectedCashFlowRole: "spending",
          reviewStatus: "needs_review",
          duplicateTransactionId: null,
          accountName: "Sample Checking",
        },
      ],
    };
  }

  const rows = await prisma.importedTransaction.findMany({
    where: { ownerUserId: userId, reviewStatus: { in: ["needs_review", "suggested"] } },
    include: { bankAccount: true },
    orderBy: [{ parsedDate: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  return {
    source: "database" as const,
    transactions: rows.map((row) => ({
      id: row.id,
      parsedDate: row.parsedDate.toISOString().slice(0, 10),
      rawDescription: row.rawDescription,
      amount: toNumber(row.amount),
      direction: row.direction,
      detectedUsageType: row.detectedUsageType,
      detectedCashFlowRole: row.detectedCashFlowRole,
      reviewStatus: row.reviewStatus,
      duplicateTransactionId: row.duplicateTransactionId,
      accountName: row.bankAccount.name,
    })),
  };
}
```

- [ ] **Step 2: Add list API**

Create `src/app/api/imported-transactions/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getRouteUser, unauthorized } from "@/lib/route-auth";
import { getImportedTransactionsForReview } from "@/lib/server-data";

export async function GET() {
  const user = await getRouteUser();
  if (!user) return unauthorized();
  return NextResponse.json(await getImportedTransactionsForReview(user.id));
}
```

- [ ] **Step 3: Add update API**

Create `src/app/api/imported-transactions/[id]/route.ts` with schema:

```ts
const updateSchema = z.object({
  detectedUsageType: z.enum(["personal", "business", "mixed", "unknown"]).optional(),
  detectedCashFlowRole: z.enum(["spending", "income", "transfer", "debt_payment", "interest", "fee", "refund", "other"]).optional(),
  reviewStatus: z.enum(["needs_review", "suggested", "confirmed", "ignored"]).optional(),
});
```

Update only rows where `id` and `ownerUserId` match.

- [ ] **Step 4: Add accept API**

Create `src/app/api/imported-transactions/[id]/accept/route.ts`. It must:

1. Fetch the staged row by `id` and `ownerUserId`.
2. Return `409` if `acceptedTransactionId` is already set.
3. Return `409` if `duplicateTransactionId` is set and request body does not include `{ "acceptDuplicate": true }`.
4. Create a ledger `transaction` with:

```ts
{
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
}
```

5. Update staged row to `reviewStatus: "accepted"` and `acceptedTransactionId`.
6. Return `{ ok: true, transactionId }`.

- [ ] **Step 5: Build review UI**

Create `src/components/review/import-review-table.tsx` as a client component. It must render:

- date
- account
- description
- amount
- personal/business/mixed/unknown select
- cash-flow role select
- duplicate warning badge
- accept button
- ignore button

Use `fetch` calls:

- `PATCH /api/imported-transactions/:id` for select changes and ignore.
- `POST /api/imported-transactions/:id/accept` for accept.

- [ ] **Step 6: Add review page**

Create `src/app/(app)/review/page.tsx`:

```tsx
import { ImportReviewTable } from "@/components/review/import-review-table";
import { requireUser } from "@/lib/auth";
import { getImportedTransactionsForReview } from "@/lib/server-data";

export default async function ReviewPage() {
  const user = await requireUser();
  const data = await getImportedTransactionsForReview(user.id);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Review</h1>
        <p className="text-sm text-neutral-600">Confirm imported transactions before they become reliable ledger data.</p>
      </header>
      <ImportReviewTable initialTransactions={data.transactions} source={data.source} />
    </div>
  );
}
```

- [ ] **Step 7: Verify**

Run:

```bash
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/imported-transactions src/components/review/import-review-table.tsx src/app/\(app\)/review/page.tsx src/lib/server-data.ts
git commit -m "feat: review and accept imported transactions"
```

---

### Task 5: Import Screen, Today Screen, And Navigation

**Files:**
- Create: `budgie-smuggler-app/src/components/import/import-upload-form.tsx`
- Create: `budgie-smuggler-app/src/app/(app)/import/page.tsx`
- Create: `budgie-smuggler-app/src/lib/today.ts`
- Create: `budgie-smuggler-app/src/components/today/action-inbox.tsx`
- Create: `budgie-smuggler-app/src/components/today/reality-summary.tsx`
- Create: `budgie-smuggler-app/src/app/(app)/today/page.tsx`
- Modify: `budgie-smuggler-app/src/lib/server-data.ts`
- Modify: `budgie-smuggler-app/src/lib/constants.ts`
- Modify: `budgie-smuggler-app/src/components/layout/mobile-nav.tsx`
- Modify: `budgie-smuggler-app/src/app/page.tsx`

- [ ] **Step 1: Add account/import getters**

Add to `src/lib/server-data.ts`:

```ts
export async function getAccounts(userId: string) {
  if (!prisma) {
    return {
      source: "mock" as const,
      accounts: [{ id: "mock-account", name: "Sample Checking", type: "checking", usageType: "personal", sourceType: "manual" }],
    };
  }

  const rows = await prisma.bankAccount.findMany({
    where: { ownerUserId: userId },
    orderBy: [{ sourceType: "asc" }, { name: "asc" }],
  });

  return {
    source: "database" as const,
    accounts: rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      usageType: row.usageType,
      sourceType: row.sourceType,
      lastImportedAt: row.lastImportedAt?.toISOString() ?? null,
    })),
  };
}
```

- [ ] **Step 2: Build import form**

Create `src/components/import/import-upload-form.tsx` as a client component with:

- account select
- account creation fields: name, type, usage type
- CSV file input
- upload button
- import result summary

The component calls:

- `POST /api/accounts` to create a manual account.
- `POST /api/imports` with `FormData` containing `bankAccountId` and `file`.

After successful import, show:

```tsx
<p>Imported {summary.total} rows. {summary.needsReview} need review.</p>
<Link href="/review">Go to review</Link>
```

- [ ] **Step 3: Add import page**

Create `src/app/(app)/import/page.tsx`:

```tsx
import { ImportUploadForm } from "@/components/import/import-upload-form";
import { requireUser } from "@/lib/auth";
import { getAccounts } from "@/lib/server-data";

export default async function ImportPage() {
  const user = await requireUser();
  const data = await getAccounts(user.id);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Import</h1>
        <p className="text-sm text-neutral-600">Upload CSV statements while Plaid is unavailable.</p>
      </header>
      <ImportUploadForm initialAccounts={data.accounts} source={data.source} />
    </div>
  );
}
```

- [ ] **Step 4: Implement Today data**

Create `src/lib/today.ts`:

```ts
import { startOfMonth } from "date-fns";
import { getOpenActionItems } from "@/lib/action-items";
import { prisma } from "@/lib/prisma";

function toNumber(value: { toNumber(): number } | number | null | undefined) {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : value.toNumber();
}

export async function getTodayData(userId: string) {
  const actionItems = await getOpenActionItems(userId, 10);

  if (!prisma) {
    return {
      source: "mock" as const,
      actionItems,
      reality: {
        cashFlow: -842,
        spending: 2840,
        income: 1998,
        needsReview: 8,
        missingDebtDetails: 2,
      },
    };
  }

  const monthStart = startOfMonth(new Date());
  const [debits, credits, stagedNeedsReview] = await Promise.all([
    prisma.transaction.aggregate({ where: { ownerUserId: userId, postedDate: { gte: monthStart }, direction: "debit", cashFlowRole: "spending" }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { ownerUserId: userId, postedDate: { gte: monthStart }, direction: "credit", cashFlowRole: "income" }, _sum: { amount: true } }),
    prisma.importedTransaction.count({ where: { ownerUserId: userId, reviewStatus: { in: ["needs_review", "suggested"] } } }),
  ]);

  const spending = toNumber(debits._sum.amount);
  const income = toNumber(credits._sum.amount);

  return {
    source: "database" as const,
    actionItems,
    reality: {
      cashFlow: income - spending,
      spending,
      income,
      needsReview: stagedNeedsReview,
      missingDebtDetails: 0,
    },
  };
}
```

- [ ] **Step 5: Build Today UI**

Create `src/components/today/action-inbox.tsx` and `src/components/today/reality-summary.tsx`.

`ActionInbox` props:

```ts
type ActionItem = {
  id: string;
  title: string;
  body?: string | null;
  priority: string;
  dueDate?: string | null;
};
```

`RealitySummary` props:

```ts
type Reality = {
  cashFlow: number;
  spending: number;
  income: number;
  needsReview: number;
  missingDebtDetails: number;
};
```

Use direct copy:

- Negative cash flow: `You are cash-flow negative this month.`
- Positive cash flow: `You are above water this month. Keep it that way.`
- Needs review: `${needsReview} imported transactions are not reliable yet.`
- Missing debt details: `${missingDebtDetails} cards are missing APR or minimum payment details.`

- [ ] **Step 6: Add Today page**

Create `src/app/(app)/today/page.tsx`:

```tsx
import { ActionInbox } from "@/components/today/action-inbox";
import { RealitySummary } from "@/components/today/reality-summary";
import { requireUser } from "@/lib/auth";
import { getTodayData } from "@/lib/today";

export default async function TodayPage() {
  const user = await requireUser();
  const data = await getTodayData(user.id);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Today</h1>
        <p className="text-sm text-neutral-600">Do the next concrete thing. No vague budgeting homework.</p>
      </header>
      <RealitySummary reality={data.reality} source={data.source} />
      <ActionInbox items={data.actionItems} />
    </div>
  );
}
```

- [ ] **Step 7: Update navigation**

Modify `src/lib/constants.ts`:

```ts
export const NAV_ITEMS = [
  { href: "/today", label: "Today" },
  { href: "/import", label: "Import" },
  { href: "/review", label: "Review" },
  { href: "/transactions", label: "Transactions" },
  { href: "/dashboard", label: "Budgets" },
  { href: "/insights", label: "Insights" },
  { href: "/settings", label: "Settings" },
] as const;
```

Modify `src/components/layout/mobile-nav.tsx` to use horizontal scrolling:

```tsx
<ul className="flex overflow-x-auto px-2">
  {NAV_ITEMS.map((item) => (
    <li key={item.href} className="shrink-0">
      ...
    </li>
  ))}
</ul>
```

- [ ] **Step 8: Redirect root to Today**

Modify `src/app/page.tsx` so signed-in app entry points at `/today`. If the current file is a public marketing page, keep public auth behavior and change only the authenticated redirect.

- [ ] **Step 9: Verify**

Run:

```bash
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/components/import/import-upload-form.tsx src/app/\(app\)/import/page.tsx src/lib/today.ts src/components/today/action-inbox.tsx src/components/today/reality-summary.tsx src/app/\(app\)/today/page.tsx src/lib/server-data.ts src/lib/constants.ts src/components/layout/mobile-nav.tsx src/app/page.tsx
git commit -m "feat: add today inbox and import workflow"
```

---

### Task 6: Grok Redaction And Classification

**Files:**
- Create: `budgie-smuggler-app/src/lib/ai/redaction.ts`
- Create: `budgie-smuggler-app/src/lib/ai/redaction.test.ts`
- Create: `budgie-smuggler-app/src/lib/ai/schemas.ts`
- Create: `budgie-smuggler-app/src/lib/ai/grok.ts`
- Create: `budgie-smuggler-app/src/app/api/ai/import-classifications/route.ts`
- Modify: `budgie-smuggler-app/src/components/review/import-review-table.tsx`

- [ ] **Step 1: Write redaction tests**

Create `src/lib/ai/redaction.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { redactForAi } from "@/lib/ai/redaction";

describe("redactForAi", () => {
  it("removes full account-like numbers but preserves useful transaction facts", () => {
    const result = redactForAi({
      accountName: "Chase Business Checking 123456789012",
      description: "AMAZON Mktp US*AB12",
      amount: 42.18,
      date: "2026-06-01",
      internalUserId: "9f1b3082-1111-4222-9222-7d14754d9abc",
    });

    expect(JSON.stringify(result.redacted)).not.toContain("123456789012");
    expect(JSON.stringify(result.redacted)).not.toContain("9f1b3082");
    expect(JSON.stringify(result.redacted)).toContain("AMAZON");
    expect(JSON.stringify(result.redacted)).toContain("42.18");
    expect(result.summary.removedLongDigitRuns).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Implement redaction**

Create `src/lib/ai/redaction.ts`:

```ts
type RedactionSummary = {
  removedLongDigitRuns: number;
  removedUuidLikeValues: number;
};

function redactValue(value: unknown, summary: RedactionSummary): unknown {
  if (typeof value === "string") {
    let output = value.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, () => {
      summary.removedUuidLikeValues += 1;
      return "[redacted-id]";
    });
    output = output.replace(/\b\d{6,}\b/g, () => {
      summary.removedLongDigitRuns += 1;
      return "[redacted-number]";
    });
    return output;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, summary));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([key]) => !key.toLowerCase().includes("userid")).map(([key, nested]) => [key, redactValue(nested, summary)]));
  }
  return value;
}

export function redactForAi<T>(input: T): { redacted: T; summary: RedactionSummary } {
  const summary = { removedLongDigitRuns: 0, removedUuidLikeValues: 0 };
  return { redacted: redactValue(input, summary) as T, summary };
}
```

- [ ] **Step 3: Add schemas**

Create `src/lib/ai/schemas.ts`:

```ts
import { z } from "zod";

export const importClassificationSchema = z.object({
  transactions: z.array(
    z.object({
      importedTransactionId: z.string(),
      suggestedCategory: z.string().nullable(),
      usageType: z.enum(["personal", "business", "mixed", "unknown"]),
      cashFlowRole: z.enum(["spending", "income", "transfer", "debt_payment", "interest", "fee", "refund", "other"]),
      subscriptionLikelihood: z.number().min(0).max(1),
      duplicateSuspicion: z.number().min(0).max(1),
      confidence: z.number().min(0).max(1),
      reason: z.string(),
      question: z.string().nullable(),
    }),
  ),
});

export type ImportClassification = z.infer<typeof importClassificationSchema>;
```

- [ ] **Step 4: Implement Grok wrapper**

Create `src/lib/ai/grok.ts` with:

```ts
import { env, isXaiConfigured } from "@/lib/env";
import { redactForAi } from "@/lib/ai/redaction";
import { importClassificationSchema, type ImportClassification } from "@/lib/ai/schemas";

export type ClassifyImportInput = {
  importedTransactionId: string;
  date: string;
  accountName: string;
  accountType?: string | null;
  accountUsageType: string;
  description: string;
  amount: number;
  direction: string;
};

export async function classifyImportedTransactions(rows: ClassifyImportInput[]): Promise<{
  source: "xai" | "fallback";
  redactionSummary: unknown;
  classification: ImportClassification;
}> {
  const { redacted, summary } = redactForAi(rows);

  if (!isXaiConfigured()) {
    return {
      source: "fallback",
      redactionSummary: summary,
      classification: {
        transactions: rows.map((row) => ({
          importedTransactionId: row.importedTransactionId,
          suggestedCategory: null,
          usageType: row.accountUsageType === "business" ? "business" : "unknown",
          cashFlowRole: row.direction === "credit" ? "income" : "spending",
          subscriptionLikelihood: 0,
          duplicateSuspicion: 0,
          confidence: 0.35,
          reason: "Grok is not configured. This fallback keeps the item reviewable.",
          question: "What is this transaction for?",
        })),
      },
    };
  }

  const config = env();
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.XAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.XAI_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "Classify imported financial transactions. Return only JSON matching this shape: {\"transactions\":[{\"importedTransactionId\":\"string\",\"suggestedCategory\":string|null,\"usageType\":\"personal|business|mixed|unknown\",\"cashFlowRole\":\"spending|income|transfer|debt_payment|interest|fee|refund|other\",\"subscriptionLikelihood\":number,\"duplicateSuspicion\":number,\"confidence\":number,\"reason\":\"string\",\"question\":string|null}]}",
        },
        {
          role: "user",
          content: JSON.stringify({ transactions: redacted }),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`xAI classification failed with status ${response.status}.`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  const parsedJson = typeof content === "string" ? JSON.parse(content) : content;
  return {
    source: "xai",
    redactionSummary: summary,
    classification: importClassificationSchema.parse(parsedJson),
  };
}
```

- [ ] **Step 5: Add classification API**

Create `src/app/api/ai/import-classifications/route.ts`. It must:

1. Authenticate with `getRouteUser`.
2. Accept `{ importedTransactionIds: string[] }`.
3. Fetch matching staged rows for the user with account names.
4. Call `classifyImportedTransactions`.
5. Create `AiRun`.
6. Create one `AiFinding` per returned classification.
7. Update staged rows with suggested `detectedUsageType`, `detectedCashFlowRole`, `detectedCategory`, `confidence`, and `reviewStatus: "suggested"` if confidence is at least `0.7`; otherwise keep `needs_review`.
8. Return the classification.

- [ ] **Step 6: Add review button**

Modify `src/components/review/import-review-table.tsx` to add a `Classify with Grok` button that sends currently visible row ids to `/api/ai/import-classifications`. On success, update rows with returned suggestions and keep them reviewable.

- [ ] **Step 7: Verify**

Run:

```bash
npm test -- src/lib/ai/redaction.test.ts
npm run typecheck
npm run lint
```

Expected: PASS without live xAI credentials.

- [ ] **Step 8: Commit**

```bash
git add src/lib/ai src/app/api/ai/import-classifications/route.ts src/components/review/import-review-table.tsx
git commit -m "feat: classify imports with grok suggestions"
```

---

### Task 7: End-To-End Verification And Documentation

**Files:**
- Modify: `budgie-smuggler-app/README.md`
- Optionally modify: files touched above to fix verification findings.

- [ ] **Step 1: Update README**

Add:

```md
## Manual Imports

CSV imports are available at `/import`. Create a manual account, upload a CSV, then review staged transactions at `/review` before they become accepted ledger transactions.

Supported CSV columns:

- `Date`, `Posted Date`, `Post Date`, or `Transaction Date`
- `Description`, `Merchant`, `Name`, `Payee`, or `Memo`
- signed `Amount`, or split `Debit`/`Credit`

## Grok Classification

Set these env vars to enable AI suggestions:

- `XAI_API_KEY`
- `XAI_MODEL` defaults to `grok-4.3`

Without `XAI_API_KEY`, the app returns deterministic fallback suggestions so imports remain usable.
```

- [ ] **Step 2: Run full checks**

Run:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: PASS. If `npm run build` fails because local env vars are intentionally missing, confirm the app's sample mode still renders and record the exact failure.

- [ ] **Step 3: Run local app**

Run:

```bash
npm run dev
```

Open `http://localhost:3000/today`.

Manual smoke test:

1. Sign in or use configured local auth flow.
2. Open `/import`.
3. Create a manual account named `Test Checking`.
4. Upload this CSV:

```csv
Date,Description,Amount
2026-06-01,Kroger,-42.18
2026-06-02,Client Payment,1200.00
2026-06-03,Netflix,-22.99
```

5. Confirm `/review` shows three rows.
6. Accept one row.
7. Confirm `/transactions` shows the accepted row.
8. Confirm `/today` shows remaining review action items.

- [ ] **Step 4: Final commit**

```bash
git add README.md
git commit -m "docs: document manual imports and grok setup"
```

---

## Self-Review

Spec coverage:

- Manual accounts are covered by Tasks 1, 3, and 5.
- CSV import is covered by Tasks 2, 3, and 5.
- Reviewable imported transactions are covered by Tasks 3 and 4.
- Today action inbox is covered by Task 5.
- Grok classification with redaction is covered by Task 6.
- PDF, debt screens, recurring dashboards, full chat, and delivered reminders are intentionally outside the first implementation scope.

Placeholder scan:

- The plan avoids placeholder language for implementation steps.
- Every created code unit has explicit responsibilities and concrete function names.

Type consistency:

- Account usage strings use `personal`, `business`, `mixed`, `unknown`.
- Cash-flow role strings use `spending`, `income`, `transfer`, `debt_payment`, `interest`, `fee`, `refund`, `other`.
- Review statuses use `needs_review`, `suggested`, `confirmed`, `accepted`, `ignored`.
