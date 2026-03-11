# Budgie Smuggler - Technical Specification (v1)

## 1) Goals and Constraints

### Product goals
- Two independent users can connect bank accounts and track spending.
- Each user can set monthly budgets by category and receive alerts.
- Users can view trends and simple personalized guidance.

### Non-negotiable constraints
- **Strict privacy isolation**: one user must never access another user's data.
- **Free-first stack**: prioritize free tiers for hosting, database, auth, and notifications.
- **Mobile-first UX**: excellent phone experience, with home-screen install support.

### v1 scope
- Email/password login.
- Plaid account linking and transaction sync.
- Category management and monthly budgets.
- Overspend/threshold alerts via email.
- Basic trend charts and rule-based spending insights.

### out of scope (v1)
- Shared/family accounts and collaborative budgets.
- Tax reporting.
- AI-generated financial advice with model inference costs.

---

## 2) Stack (Free-First)

- **Frontend/API**: Next.js (App Router, TypeScript) on Vercel free tier.
- **Database/Auth**: Supabase Postgres + Supabase Auth (free tier).
- **ORM**: Prisma.
- **Bank data**: Plaid API (Sandbox -> Development for real institutions).
- **Email alerts**: Resend free tier.
- **Jobs/scheduling**: Vercel Cron + idempotent API routes.
- **Analytics/monitoring**: lightweight logs in DB first, optionally Sentry free tier.

---

## 3) High-Level Architecture

1. User signs in with Supabase Auth.
2. Frontend opens Plaid Link token flow.
3. Backend exchanges `public_token` for `access_token`, stores encrypted token metadata.
4. Sync job pulls transactions incrementally and upserts into Postgres.
5. Budget engine evaluates thresholds and overspends.
6. Alert engine emits email notifications through Resend.
7. Dashboard reads only authenticated user's scoped data.

---

## 4) Data Model (Postgres)

> Rule: every user-owned table includes `owner_user_id UUID NOT NULL`.

### Core tables
- `profiles`
  - `id UUID PK` (matches `auth.users.id`)
  - `display_name TEXT`
  - `timezone TEXT DEFAULT 'America/Chicago'`
  - `currency_code TEXT DEFAULT 'USD'`
  - `created_at TIMESTAMPTZ DEFAULT now()`

- `plaid_items`
  - `id UUID PK`
  - `owner_user_id UUID NOT NULL`
  - `plaid_item_id TEXT NOT NULL UNIQUE`
  - `access_token_encrypted TEXT NOT NULL`
  - `institution_name TEXT`
  - `last_cursor TEXT`
  - `last_sync_at TIMESTAMPTZ`
  - `sync_status TEXT DEFAULT 'healthy'`
  - `created_at TIMESTAMPTZ DEFAULT now()`

- `bank_accounts`
  - `id UUID PK`
  - `owner_user_id UUID NOT NULL`
  - `plaid_item_id UUID NOT NULL REFERENCES plaid_items(id)`
  - `plaid_account_id TEXT NOT NULL UNIQUE`
  - `name TEXT NOT NULL`
  - `mask TEXT`
  - `type TEXT`
  - `subtype TEXT`
  - `current_balance NUMERIC(14,2)`
  - `available_balance NUMERIC(14,2)`
  - `last_balance_at TIMESTAMPTZ`

- `categories`
  - `id UUID PK`
  - `owner_user_id UUID NOT NULL`
  - `name TEXT NOT NULL`
  - `color TEXT`
  - `icon TEXT`
  - `is_system BOOLEAN DEFAULT false`
  - `created_at TIMESTAMPTZ DEFAULT now()`
  - `UNIQUE(owner_user_id, name)`

- `transactions`
  - `id UUID PK`
  - `owner_user_id UUID NOT NULL`
  - `bank_account_id UUID NOT NULL REFERENCES bank_accounts(id)`
  - `plaid_transaction_id TEXT UNIQUE`
  - `posted_date DATE NOT NULL`
  - `merchant_name TEXT`
  - `description TEXT`
  - `amount NUMERIC(14,2) NOT NULL`
  - `direction TEXT NOT NULL` -- debit/credit normalized
  - `pending BOOLEAN DEFAULT false`
  - `category_id UUID REFERENCES categories(id)`
  - `raw_category TEXT[]`
  - `created_at TIMESTAMPTZ DEFAULT now()`
  - `updated_at TIMESTAMPTZ DEFAULT now()`

- `monthly_budgets`
  - `id UUID PK`
  - `owner_user_id UUID NOT NULL`
  - `month_start DATE NOT NULL` -- first day of month
  - `category_id UUID NOT NULL REFERENCES categories(id)`
  - `amount_limit NUMERIC(14,2) NOT NULL`
  - `rollover_enabled BOOLEAN DEFAULT false`
  - `UNIQUE(owner_user_id, month_start, category_id)`

- `alerts`
  - `id UUID PK`
  - `owner_user_id UUID NOT NULL`
  - `type TEXT NOT NULL` -- threshold, overspend, unusual_spend, digest
  - `channel TEXT NOT NULL DEFAULT 'email'`
  - `enabled BOOLEAN DEFAULT true`
  - `config JSONB NOT NULL DEFAULT '{}'::jsonb`
  - `created_at TIMESTAMPTZ DEFAULT now()`

- `alert_events`
  - `id UUID PK`
  - `owner_user_id UUID NOT NULL`
  - `alert_id UUID NOT NULL REFERENCES alerts(id)`
  - `status TEXT NOT NULL` -- queued, sent, failed, skipped
  - `dedupe_key TEXT NOT NULL`
  - `payload JSONB NOT NULL`
  - `sent_at TIMESTAMPTZ`
  - `created_at TIMESTAMPTZ DEFAULT now()`
  - `UNIQUE(owner_user_id, dedupe_key)`

- `insight_snapshots`
  - `id UUID PK`
  - `owner_user_id UUID NOT NULL`
  - `window_start DATE NOT NULL`
  - `window_end DATE NOT NULL`
  - `insight_type TEXT NOT NULL`
  - `summary TEXT NOT NULL`
  - `details JSONB NOT NULL`
  - `created_at TIMESTAMPTZ DEFAULT now()`

---

## 5) Security and Isolation

### Authentication
- Supabase Auth session/JWT required for all private routes.
- Backend extracts `auth.uid()` from verified JWT.

### Authorization model
- Every query is user-scoped by `owner_user_id = auth.uid()`.
- Never allow client to supply `owner_user_id`; derive server-side.

### Row Level Security (critical)
Enable RLS on all user-owned tables and add policies like:

```sql
alter table transactions enable row level security;

create policy "transactions_select_own"
on transactions for select
using (owner_user_id = auth.uid());

create policy "transactions_insert_own"
on transactions for insert
with check (owner_user_id = auth.uid());

create policy "transactions_update_own"
on transactions for update
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

create policy "transactions_delete_own"
on transactions for delete
using (owner_user_id = auth.uid());
```

Repeat equivalent policies for: `plaid_items`, `bank_accounts`, `categories`, `monthly_budgets`, `alerts`, `alert_events`, `insight_snapshots`.

### Secret handling
- Encrypt Plaid `access_token` before database storage.
- Store encryption key in platform env vars; never in repo.
- Verify Plaid webhooks with signature validation.

---

## 6) Plaid Integration Design

### Initial link flow
1. `POST /api/plaid/link-token` -> create link token for logged-in user.
2. Frontend Plaid Link returns `public_token`.
3. `POST /api/plaid/exchange-token` exchanges token, fetches accounts, stores `plaid_items` and `bank_accounts`.
4. Trigger initial transactions sync.

### Incremental sync flow
- Use Plaid transactions sync cursor (`last_cursor`).
- Scheduled sync runs every 2-4 hours per item.
- Webhook (`/api/plaid/webhook`) enqueues immediate incremental sync.
- Idempotent upsert keyed by `plaid_transaction_id`.

### Sync state
- Show `last_sync_at` and `sync_status` in UI.
- Failure states write to sync logs and surface retry action.

---

## 7) API Surface (v1)

All endpoints require auth unless specified.

### Auth/profile
- `GET /api/me` -> profile and preferences.
- `PATCH /api/me` -> update timezone/currency/display name.

### Plaid
- `POST /api/plaid/link-token`
- `POST /api/plaid/exchange-token`
- `POST /api/plaid/webhook` (Plaid-only signature verified)
- `POST /api/plaid/sync-now` (manual resync trigger)

### Accounts/transactions
- `GET /api/accounts`
- `GET /api/transactions?from=YYYY-MM-DD&to=YYYY-MM-DD&categoryId=&accountId=`
- `PATCH /api/transactions/:id` (category override, notes if added)

### Categories/budgets
- `GET /api/categories`
- `POST /api/categories`
- `PATCH /api/categories/:id`
- `GET /api/budgets?month=YYYY-MM-01`
- `PUT /api/budgets/:month` (bulk upsert category limits)

### Alerts/insights
- `GET /api/alerts`
- `PUT /api/alerts` (enable/disable + thresholds)
- `GET /api/insights?window=30d`

---

## 8) Budget and Alert Logic

### Budget calculations
- Monthly category spend = sum(debit transactions in category within month).
- Remaining = `amount_limit - spent`.
- Percentage used = `spent / amount_limit`.

### v1 alert rules
- Threshold: trigger at 50%, 80%, 100% (configurable).
- Overspend: trigger when spend exceeds limit.
- Unusual spend: trigger if category spend is >X% above trailing 3-month average.
- Weekly digest: summary email on user-selected day.

### Alert dedupe
- Use `dedupe_key` pattern:
  - `threshold:{budget_id}:{month}:{threshold_percent}`
  - `overspend:{budget_id}:{month}`
- Avoid repeated email spam for same event.

---

## 9) Insights (Rule-Based v1)

Generate deterministic insights nightly:
- Top 3 categories by spend delta month-over-month.
- Recurring charge candidates (similar merchant + amount cadence).
- Large one-off transactions over user-defined threshold.
- Budget risk categories likely to exceed limit by month-end.

Output format:
- short summary string
- structured JSON for charts/details

---

## 10) Mobile-First UX + PWA Requirements

### UX principles
- Dashboard-first; critical information in first viewport.
- Large touch targets; bottom navigation.
- Minimize typing; prefer quick toggles and presets.

### Required screens
1. Auth: sign in/sign up/forgot password.
2. Onboarding: connect bank and first-sync status.
3. Dashboard: total spend this month, remaining budget, alert cards.
4. Transactions: filterable feed + category recategorization.
5. Budgets: per-category limits and progress bars.
6. Insights: trends and recommendations.
7. Settings: alerts, profile, connected institutions, manual resync.

### PWA requirements
- Web app manifest + icons + splash metadata.
- Service worker for app shell caching.
- “Install app” prompt and instructions for iOS/Android bookmark-to-home-screen.
- Responsive breakpoints for `<= 480`, `481-768`, `769+`.

---

## 11) Implementation Plan (6 Weeks)

### Week 1 - Foundation
- Bootstrap Next.js app, Supabase project, Prisma schema.
- Implement auth flows and protected routes.
- Create DB migrations and RLS policies.
- Deliverable: each user can sign in and only access own empty workspace.

### Week 2 - Plaid Core
- Implement Plaid Link token/exchange flow.
- Store item/account data securely.
- Build first transaction sync route + transaction feed UI.
- Deliverable: each user sees only their own bank accounts/transactions.

### Week 3 - Budgeting
- Categories CRUD and monthly budget setup.
- Budget progress calculations and dashboard widgets.
- Deliverable: budget limits + remaining amount visible by category.

### Week 4 - Alerts
- Threshold/overspend evaluator and cron jobs.
- Resend email templates and preferences UI.
- Deliverable: email alerts sent with dedupe protection.

### Week 5 - Insights + Mobile polish
- Trend and recurring-charge insights.
- Responsive layout hardening + PWA install flow.
- Deliverable: mobile-friendly dashboard + insights page.

### Week 6 - Stabilization
- Error handling, retry logic, sync logs, manual resync.
- Basic test coverage (auth, RLS, budget math, alert dedupe).
- Security checklist and pre-launch validation.
- Deliverable: stable v1 ready for real daily use by two users.

---

## 12) Acceptance Criteria (MVP)

- User A cannot access any User B data at UI, API, or DB levels.
- Plaid sync succeeds for at least one institution per user and updates incrementally.
- Budgets accurately compute spent/remaining by month and category.
- Threshold and overspend alerts send exactly once per dedupe event.
- App is usable on mobile with add-to-home-screen support.
- "Last synced" timestamp is visible and accurate.

---

## 13) Risks and Mitigations

- **Bank refresh latency**: show sync timestamp and manual sync action.
- **Free-tier limits**: monitor usage; prune logs and keep payloads lean.
- **Alert fatigue**: configurable thresholds + digest default.
- **Data quality**: allow manual recategorization and category overrides.

---

## 14) Build-Start Checklist

1. Create Supabase project and enable email auth.
2. Add Plaid Sandbox credentials and webhook secret.
3. Set env vars in local + Vercel.
4. Run first migration with all RLS policies enabled.
5. Implement auth middleware and `/api/me` health check.
6. Implement Plaid link/exchange and initial sync.
7. Build dashboard shell and transaction list.

