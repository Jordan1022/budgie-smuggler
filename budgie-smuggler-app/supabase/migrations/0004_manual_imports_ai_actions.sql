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

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  bank_account_id uuid not null references public.bank_accounts(id) on delete cascade,
  file_name text not null,
  file_type text not null,
  file_hash text not null,
  parser_status text not null default 'parsed',
  detected_start_date date,
  detected_end_date date,
  raw_file_storage_path text,
  extracted_text_path text,
  redaction_summary jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.imported_transactions (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null references public.import_batches(id) on delete cascade,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  bank_account_id uuid not null references public.bank_accounts(id) on delete cascade,
  raw_date text,
  parsed_date date not null,
  raw_description text not null,
  normalized_description text not null,
  amount numeric(14,2) not null,
  direction text not null,
  detected_category text,
  detected_usage_type text not null default 'unknown',
  detected_cash_flow_role text not null default 'spending',
  duplicate_transaction_id uuid,
  confidence numeric(5,4),
  review_status text not null default 'needs_review',
  source_row jsonb not null,
  accepted_transaction_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.action_items (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  priority text not null default 'normal',
  due_date date,
  status text not null default 'open',
  related_entity_type text,
  related_entity_id uuid,
  source text not null default 'system',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'xai',
  model text not null,
  purpose text not null,
  redaction_level text not null,
  prompt_version text not null,
  input_summary jsonb not null,
  output_status text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_findings (
  id uuid primary key default gen_random_uuid(),
  ai_run_id uuid not null references public.ai_runs(id) on delete cascade,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  finding_type text not null,
  structured_output jsonb not null,
  confidence numeric(5,4),
  related_entity_type text,
  related_entity_id uuid,
  review_status text not null default 'suggested',
  created_at timestamptz not null default now()
);

create index if not exists idx_import_batches_owner_created
  on public.import_batches(owner_user_id, created_at);

create index if not exists idx_imported_transactions_owner_status
  on public.imported_transactions(owner_user_id, review_status);

create index if not exists idx_imported_transactions_owner_date
  on public.imported_transactions(owner_user_id, parsed_date);

create index if not exists idx_action_items_owner_status_priority
  on public.action_items(owner_user_id, status, priority);

create index if not exists idx_ai_runs_owner_created
  on public.ai_runs(owner_user_id, created_at);

create index if not exists idx_ai_findings_owner_status
  on public.ai_findings(owner_user_id, review_status);

drop trigger if exists trg_imported_transactions_updated_at on public.imported_transactions;
create trigger trg_imported_transactions_updated_at
before update on public.imported_transactions
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_action_items_updated_at on public.action_items;
create trigger trg_action_items_updated_at
before update on public.action_items
for each row execute procedure public.set_updated_at();

alter table public.import_batches enable row level security;
alter table public.imported_transactions enable row level security;
alter table public.action_items enable row level security;
alter table public.ai_runs enable row level security;
alter table public.ai_findings enable row level security;

create policy "import_batches_select_own" on public.import_batches for select using (owner_user_id = auth.uid());
create policy "import_batches_insert_own" on public.import_batches for insert with check (owner_user_id = auth.uid());
create policy "import_batches_update_own" on public.import_batches for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "import_batches_delete_own" on public.import_batches for delete using (owner_user_id = auth.uid());

create policy "imported_transactions_select_own" on public.imported_transactions for select using (owner_user_id = auth.uid());
create policy "imported_transactions_insert_own" on public.imported_transactions for insert with check (owner_user_id = auth.uid());
create policy "imported_transactions_update_own" on public.imported_transactions for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "imported_transactions_delete_own" on public.imported_transactions for delete using (owner_user_id = auth.uid());

create policy "action_items_select_own" on public.action_items for select using (owner_user_id = auth.uid());
create policy "action_items_insert_own" on public.action_items for insert with check (owner_user_id = auth.uid());
create policy "action_items_update_own" on public.action_items for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "action_items_delete_own" on public.action_items for delete using (owner_user_id = auth.uid());

create policy "ai_runs_select_own" on public.ai_runs for select using (owner_user_id = auth.uid());
create policy "ai_runs_insert_own" on public.ai_runs for insert with check (owner_user_id = auth.uid());
create policy "ai_runs_update_own" on public.ai_runs for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "ai_runs_delete_own" on public.ai_runs for delete using (owner_user_id = auth.uid());

create policy "ai_findings_select_own" on public.ai_findings for select using (owner_user_id = auth.uid());
create policy "ai_findings_insert_own" on public.ai_findings for insert with check (owner_user_id = auth.uid());
create policy "ai_findings_update_own" on public.ai_findings for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "ai_findings_delete_own" on public.ai_findings for delete using (owner_user_id = auth.uid());
