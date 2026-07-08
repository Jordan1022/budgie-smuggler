# Budgie Smuggler

Private, mobile-first budgeting app for two independent users. Each login has fully isolated financial data and cannot access any other user's records.

## Current Product Features

- Use Today as the default action inbox for concrete money tasks.
- Create manual personal, business, mixed, or unknown accounts without Plaid.
- Upload CSV or text-based PDF statements, stage imported rows, and review them before ledger acceptance.
- Track debt accounts with APR, minimum payment, due dates, credit limits, and personal/business usage.
- Scan accepted transactions for subscriptions and recurring charges.
- Review household, personal/business, debt-pressure, and subscription cut-list reports.
- Generate a Grok-backed money brief and ask money questions in Coach when xAI credentials are configured.
- Use Grok-backed classification suggestions for imported transactions when xAI credentials are configured.
- Create custom budget categories and assign monthly limits in the Budgets screen.
- Auto-map Plaid transactions into your custom categories using rule-based matching.
- Manually override transaction categories and lock them so future syncs do not overwrite your choice.
- Configure notification channels and alert types in Settings:
  - Channels: email, in-app (push is queued for future delivery integration)
  - Types: threshold, overspend, unusual spend, weekly digest

## Stack

- Next.js 16 (App Router, TypeScript)
- Supabase Auth + Postgres (free tier)
- Prisma ORM
- Plaid Transactions API
- xAI/Grok for optional import classification
- Resend email alerts
- PWA support (installable on iOS/Android home screen)

## Privacy Model

- Every user-owned record includes `owner_user_id`.
- App-layer authorization scopes all reads/writes by authenticated user ID.
- DB layer includes Row Level Security policies for strict isolation.

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Configure env vars:

```bash
cp .env.example .env.local
```

3. Generate Prisma client:

```bash
npm run prisma:generate
```

4. Start dev server:

```bash
npm run dev
```

## Supabase Setup

1. Create a Supabase project.
2. Enable email/password auth.
3. Run SQL migration in Supabase SQL editor:

- File: `supabase/migrations/0001_initial.sql`
- File: `supabase/migrations/0002_alert_prefs_and_category_lock.sql`
- File: `supabase/migrations/0004_manual_imports_ai_actions.sql`
- File: `supabase/migrations/0005_debt_recurring_core.sql`

4. Set values in `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`

## Plaid Setup

1. Create Plaid app and use Sandbox first.
2. Set:

- `PLAID_CLIENT_ID`
- `PLAID_SECRET`
- `PLAID_ENV`

3. Configure webhook URL:

- `https://<your-domain>/api/plaid/webhook`

## Email Alerts Setup

1. Create Resend API key.
2. Set:

- `RESEND_API_KEY`
- `ALERT_FROM_EMAIL`

## Manual Imports

CSV and text-based PDF imports are available at `/import`. Create a manual account, upload a statement, then review staged transactions at `/review` before they become accepted ledger transactions.

Supported CSV columns:

- `Date`, `Posted Date`, `Post Date`, or `Transaction Date`
- `Description`, `Merchant`, `Name`, `Payee`, or `Memo`
- signed `Amount`, or split `Debit`/`Credit`

PDF imports are best-effort text extraction. Scanned image PDFs need OCR before import.

## Grok Classification

Set these env vars to enable AI suggestions:

- `XAI_API_KEY`
- `XAI_MODEL` defaults to `grok-4.3`

Without `XAI_API_KEY`, the app returns deterministic fallback suggestions so imports remain usable.

## Debt And Recurring Control

- `/debt` stores credit cards, loans, APRs, minimum payments, due dates, credit limits, and usage type.
- `/recurring` scans accepted debit transactions for subscriptions and recurring charges.
- `/today` shows in-app action items for missing debt details, upcoming card payments, high utilization, interest pressure, suspected subscriptions, price increases, and unclear personal/business usage.
- The alert cron sends or queues daily reminder events for open high/urgent action items when alert delivery is configured.

## Reports And Coach

- `/reports` shows household net, debt balance, estimated monthly interest, recurring monthly spend, personal/business rows, debt warnings, and a subscription cut list.
- `/coach` generates a daily money brief and answers direct money questions. With `XAI_API_KEY`, it uses Grok. Without it, it returns deterministic rule-based fallback output.

## Cron Jobs (Vercel)

`vercel.json` schedules:

- `/api/cron/alerts` every 4 hours
- `/api/cron/insights` daily at 07:00 UTC

## Scripts

```bash
npm run dev
npm run lint
npm run typecheck
npm run test
npm run build
```

## Current Behavior Without Credentials

If Supabase/Postgres/Plaid/Resend/xAI are not configured yet, the app still runs in sample mode:

- UI uses mock budget/transaction/insight data.
- API endpoints return mock or graceful "not configured" responses.
- Grok classification falls back to reviewable local suggestions.
- This keeps local development moving while integrations are being configured.
