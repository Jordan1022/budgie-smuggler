create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'America/Chicago',
  currency_code text not null default 'USD',
  created_at timestamptz not null default now()
);

create table if not exists public.plaid_items (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  plaid_item_id text not null unique,
  access_token_encrypted text not null,
  institution_name text,
  last_cursor text,
  last_sync_at timestamptz,
  sync_status text not null default 'healthy',
  created_at timestamptz not null default now()
);

create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  plaid_item_ref_id uuid not null references public.plaid_items(id) on delete cascade,
  plaid_account_id text not null unique,
  name text not null,
  mask text,
  type text,
  subtype text,
  current_balance numeric(14,2),
  available_balance numeric(14,2),
  last_balance_at timestamptz
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  color text,
  icon text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique(owner_user_id, name)
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  bank_account_id uuid not null references public.bank_accounts(id) on delete cascade,
  plaid_transaction_id text unique,
  posted_date date not null,
  merchant_name text,
  description text,
  amount numeric(14,2) not null,
  direction text not null,
  pending boolean not null default false,
  category_id uuid references public.categories(id) on delete set null,
  raw_category text[] not null default array[]::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.monthly_budgets (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  month_start date not null,
  category_id uuid not null references public.categories(id) on delete cascade,
  amount_limit numeric(14,2) not null,
  rollover_enabled boolean not null default false,
  unique(owner_user_id, month_start, category_id)
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  channel text not null default 'email',
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.alert_events (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  alert_id uuid not null references public.alerts(id) on delete cascade,
  status text not null,
  dedupe_key text not null,
  payload jsonb not null,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique(owner_user_id, dedupe_key)
);

create table if not exists public.insight_snapshots (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  window_start date not null,
  window_end date not null,
  insight_type text not null,
  summary text not null,
  details jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_plaid_items_owner on public.plaid_items(owner_user_id);
create index if not exists idx_bank_accounts_owner on public.bank_accounts(owner_user_id);
create index if not exists idx_transactions_owner_date on public.transactions(owner_user_id, posted_date);
create index if not exists idx_monthly_budgets_owner on public.monthly_budgets(owner_user_id);
create index if not exists idx_alerts_owner on public.alerts(owner_user_id);
create index if not exists idx_alert_events_owner on public.alert_events(owner_user_id);
create index if not exists idx_insight_snapshots_owner on public.insight_snapshots(owner_user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_transactions_updated_at on public.transactions;
create trigger trg_transactions_updated_at
before update on public.transactions
for each row execute procedure public.set_updated_at();

-- enable row level security
alter table public.profiles enable row level security;
alter table public.plaid_items enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.monthly_budgets enable row level security;
alter table public.alerts enable row level security;
alter table public.alert_events enable row level security;
alter table public.insight_snapshots enable row level security;

-- helper policy block for owner tables
create policy "profiles_select_own" on public.profiles for select using (id = auth.uid());
create policy "profiles_insert_own" on public.profiles for insert with check (id = auth.uid());
create policy "profiles_update_own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "plaid_items_select_own" on public.plaid_items for select using (owner_user_id = auth.uid());
create policy "plaid_items_insert_own" on public.plaid_items for insert with check (owner_user_id = auth.uid());
create policy "plaid_items_update_own" on public.plaid_items for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "plaid_items_delete_own" on public.plaid_items for delete using (owner_user_id = auth.uid());

create policy "bank_accounts_select_own" on public.bank_accounts for select using (owner_user_id = auth.uid());
create policy "bank_accounts_insert_own" on public.bank_accounts for insert with check (owner_user_id = auth.uid());
create policy "bank_accounts_update_own" on public.bank_accounts for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "bank_accounts_delete_own" on public.bank_accounts for delete using (owner_user_id = auth.uid());

create policy "categories_select_own" on public.categories for select using (owner_user_id = auth.uid());
create policy "categories_insert_own" on public.categories for insert with check (owner_user_id = auth.uid());
create policy "categories_update_own" on public.categories for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "categories_delete_own" on public.categories for delete using (owner_user_id = auth.uid());

create policy "transactions_select_own" on public.transactions for select using (owner_user_id = auth.uid());
create policy "transactions_insert_own" on public.transactions for insert with check (owner_user_id = auth.uid());
create policy "transactions_update_own" on public.transactions for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "transactions_delete_own" on public.transactions for delete using (owner_user_id = auth.uid());

create policy "monthly_budgets_select_own" on public.monthly_budgets for select using (owner_user_id = auth.uid());
create policy "monthly_budgets_insert_own" on public.monthly_budgets for insert with check (owner_user_id = auth.uid());
create policy "monthly_budgets_update_own" on public.monthly_budgets for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "monthly_budgets_delete_own" on public.monthly_budgets for delete using (owner_user_id = auth.uid());

create policy "alerts_select_own" on public.alerts for select using (owner_user_id = auth.uid());
create policy "alerts_insert_own" on public.alerts for insert with check (owner_user_id = auth.uid());
create policy "alerts_update_own" on public.alerts for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "alerts_delete_own" on public.alerts for delete using (owner_user_id = auth.uid());

create policy "alert_events_select_own" on public.alert_events for select using (owner_user_id = auth.uid());
create policy "alert_events_insert_own" on public.alert_events for insert with check (owner_user_id = auth.uid());
create policy "alert_events_update_own" on public.alert_events for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "alert_events_delete_own" on public.alert_events for delete using (owner_user_id = auth.uid());

create policy "insight_snapshots_select_own" on public.insight_snapshots for select using (owner_user_id = auth.uid());
create policy "insight_snapshots_insert_own" on public.insight_snapshots for insert with check (owner_user_id = auth.uid());
create policy "insight_snapshots_update_own" on public.insight_snapshots for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "insight_snapshots_delete_own" on public.insight_snapshots for delete using (owner_user_id = auth.uid());
