create table if not exists public.debt_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  bank_account_id uuid references public.bank_accounts(id) on delete set null,
  name text not null,
  debt_type text not null default 'credit_card',
  usage_type text not null default 'unknown',
  balance numeric(14,2) not null,
  apr numeric(7,4),
  minimum_payment numeric(14,2),
  payment_due_day integer,
  next_due_date date,
  statement_close_day integer,
  credit_limit numeric(14,2),
  promo_apr numeric(7,4),
  promo_apr_expires_on date,
  spending_status text not null default 'active',
  last_payment_amount numeric(14,2),
  last_payment_date date,
  last_statement_balance numeric(14,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint debt_accounts_payment_due_day_check check (payment_due_day is null or payment_due_day between 1 and 31),
  constraint debt_accounts_statement_close_day_check check (statement_close_day is null or statement_close_day between 1 and 31)
);

create table if not exists public.recurring_items (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  merchant_name text not null,
  normalized_merchant_key text not null,
  usage_type text not null default 'unknown',
  category_id uuid references public.categories(id) on delete set null,
  amount_min numeric(14,2) not null,
  amount_max numeric(14,2) not null,
  typical_amount numeric(14,2) not null,
  cadence text not null default 'unknown',
  next_expected_date date,
  last_seen_date date not null,
  transaction_count integer not null default 0,
  status text not null default 'suspected',
  price_increase_detected boolean not null default false,
  increase_amount numeric(14,2),
  source text not null default 'rule',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_user_id, normalized_merchant_key, cadence)
);

create table if not exists public.recurring_transaction_links (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  recurring_item_id uuid not null references public.recurring_items(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(owner_user_id, recurring_item_id, transaction_id)
);

create index if not exists idx_debt_accounts_owner
  on public.debt_accounts(owner_user_id);

create index if not exists idx_debt_accounts_owner_due
  on public.debt_accounts(owner_user_id, next_due_date);

create index if not exists idx_recurring_items_owner_status
  on public.recurring_items(owner_user_id, status);

create index if not exists idx_recurring_items_owner_next_expected
  on public.recurring_items(owner_user_id, next_expected_date);

create index if not exists idx_recurring_transaction_links_owner_transaction
  on public.recurring_transaction_links(owner_user_id, transaction_id);

drop trigger if exists trg_debt_accounts_updated_at on public.debt_accounts;
create trigger trg_debt_accounts_updated_at
before update on public.debt_accounts
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_recurring_items_updated_at on public.recurring_items;
create trigger trg_recurring_items_updated_at
before update on public.recurring_items
for each row execute procedure public.set_updated_at();

alter table public.debt_accounts enable row level security;
alter table public.recurring_items enable row level security;
alter table public.recurring_transaction_links enable row level security;

create policy "debt_accounts_select_own" on public.debt_accounts for select using (owner_user_id = auth.uid());
create policy "debt_accounts_insert_own" on public.debt_accounts for insert with check (owner_user_id = auth.uid());
create policy "debt_accounts_update_own" on public.debt_accounts for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "debt_accounts_delete_own" on public.debt_accounts for delete using (owner_user_id = auth.uid());

create policy "recurring_items_select_own" on public.recurring_items for select using (owner_user_id = auth.uid());
create policy "recurring_items_insert_own" on public.recurring_items for insert with check (owner_user_id = auth.uid());
create policy "recurring_items_update_own" on public.recurring_items for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "recurring_items_delete_own" on public.recurring_items for delete using (owner_user_id = auth.uid());

create policy "recurring_transaction_links_select_own" on public.recurring_transaction_links for select using (owner_user_id = auth.uid());
create policy "recurring_transaction_links_insert_own" on public.recurring_transaction_links for insert with check (owner_user_id = auth.uid());
create policy "recurring_transaction_links_update_own" on public.recurring_transaction_links for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "recurring_transaction_links_delete_own" on public.recurring_transaction_links for delete using (owner_user_id = auth.uid());
