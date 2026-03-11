alter table public.transactions
  add column if not exists user_override_category boolean not null default false;

create unique index if not exists idx_alerts_owner_type_unique
  on public.alerts(owner_user_id, type);
