# Budgie Smuggler

Private, mobile-first budgeting app for two independent users. Each login has fully isolated financial data and cannot access any other user's records.

## Current Product Features

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

If Supabase/Postgres/Plaid/Resend are not configured yet, the app still runs in sample mode:

- UI uses mock budget/transaction/insight data.
- API endpoints return mock or graceful "not configured" responses.
- This keeps local development moving while integrations are being configured.
