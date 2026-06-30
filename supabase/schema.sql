create extension if not exists "pgcrypto";

drop table if exists public.transactions;
drop table if exists public.transaction_rules;
drop table if exists public.categories;
drop table if exists public.accounts;
drop table if exists public.goals;
drop table if exists public.profiles;

create table public.profiles (
  id text primary key default 'main',
  full_name text,
  created_at timestamptz not null default now()
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default 'main' references public.profiles(id) on delete cascade,
  name text not null,
  type text not null check (type in ('bank', 'wallet', 'cash', 'other')),
  balance numeric(12, 2) not null default 0,
  currency text not null default 'EUR',
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default 'main' references public.profiles(id) on delete cascade,
  name text not null,
  type text not null check (type in ('income', 'expense')),
  created_at timestamptz not null default now(),
  unique (user_id, name, type)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default 'main' references public.profiles(id) on delete cascade,
  type text not null check (type in ('income', 'expense', 'transfer')),
  amount numeric(12, 2) not null check (amount >= 0),
  category_id uuid constraint transactions_category_id_fkey references public.categories(id) on delete set null,
  account_id uuid constraint transactions_account_id_fkey references public.accounts(id) on delete set null,
  from_account_id uuid constraint transactions_from_account_id_fkey references public.accounts(id) on delete set null,
  to_account_id uuid constraint transactions_to_account_id_fkey references public.accounts(id) on delete set null,
  description text,
  date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transaction_shape check (
    (
      type in ('income', 'expense')
      and account_id is not null
      and from_account_id is null
      and to_account_id is null
    )
    or
    (
      type = 'transfer'
      and category_id is null
      and account_id is null
      and from_account_id is not null
      and to_account_id is not null
      and from_account_id <> to_account_id
    )
  )
);

create table public.transaction_rules (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default 'main' references public.profiles(id) on delete cascade,
  merchant_pattern text not null,
  transaction_type text not null check (transaction_type in ('income', 'expense', 'transfer')),
  category_id uuid references public.categories(id) on delete set null,
  confidence integer not null default 96 check (confidence >= 0 and confidence <= 100),
  created_at timestamptz not null default now(),
  unique (user_id, merchant_pattern)
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default 'main' references public.profiles(id) on delete cascade,
  title text not null,
  target_amount numeric(12, 2) not null check (target_amount >= 0),
  current_amount numeric(12, 2) not null default 0 check (current_amount >= 0),
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger transactions_set_updated_at
before update on public.transactions
for each row execute function public.set_updated_at();

insert into public.profiles (id, full_name)
values ('main', 'Gonçalo')
on conflict (id) do update set full_name = excluded.full_name;

insert into public.accounts (user_id, name, type, balance, currency)
values
  ('main', 'Millennium', 'bank', 0, 'EUR'),
  ('main', 'Revolut', 'wallet', 0, 'EUR'),
  ('main', 'Dinheiro', 'cash', 0, 'EUR')
on conflict (user_id, name) do nothing;

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_rules enable row level security;
alter table public.goals enable row level security;

create policy "shared_profile_read" on public.profiles for select to anon using (id = 'main');
create policy "shared_profile_write" on public.profiles for insert to anon with check (id = 'main');
create policy "shared_profile_update" on public.profiles for update to anon using (id = 'main') with check (id = 'main');

create policy "shared_accounts_read" on public.accounts for select to anon using (user_id = 'main');
create policy "shared_accounts_insert" on public.accounts for insert to anon with check (user_id = 'main');
create policy "shared_accounts_update" on public.accounts for update to anon using (user_id = 'main') with check (user_id = 'main');
create policy "shared_accounts_delete" on public.accounts for delete to anon using (user_id = 'main');

create policy "shared_categories_read" on public.categories for select to anon using (user_id = 'main');
create policy "shared_categories_insert" on public.categories for insert to anon with check (user_id = 'main');
create policy "shared_categories_update" on public.categories for update to anon using (user_id = 'main') with check (user_id = 'main');
create policy "shared_categories_delete" on public.categories for delete to anon using (user_id = 'main');

create policy "shared_transactions_read" on public.transactions for select to anon using (user_id = 'main');
create policy "shared_transactions_insert" on public.transactions for insert to anon with check (user_id = 'main');
create policy "shared_transactions_update" on public.transactions for update to anon using (user_id = 'main') with check (user_id = 'main');
create policy "shared_transactions_delete" on public.transactions for delete to anon using (user_id = 'main');

create policy "shared_transaction_rules_read" on public.transaction_rules for select to anon using (user_id = 'main');
create policy "shared_transaction_rules_insert" on public.transaction_rules for insert to anon with check (user_id = 'main');
create policy "shared_transaction_rules_update" on public.transaction_rules for update to anon using (user_id = 'main') with check (user_id = 'main');
create policy "shared_transaction_rules_delete" on public.transaction_rules for delete to anon using (user_id = 'main');

create policy "shared_goals_read" on public.goals for select to anon using (user_id = 'main');
create policy "shared_goals_insert" on public.goals for insert to anon with check (user_id = 'main');
create policy "shared_goals_update" on public.goals for update to anon using (user_id = 'main') with check (user_id = 'main');
create policy "shared_goals_delete" on public.goals for delete to anon using (user_id = 'main');

create index accounts_user_idx on public.accounts(user_id);
create index transactions_user_date_idx on public.transactions(user_id, date desc);
create index transactions_account_idx on public.transactions(user_id, account_id);
create index transactions_from_account_idx on public.transactions(user_id, from_account_id);
create index transactions_to_account_idx on public.transactions(user_id, to_account_id);
create index transaction_rules_user_idx on public.transaction_rules(user_id);
create index transaction_rules_pattern_idx on public.transaction_rules(user_id, merchant_pattern);
create index categories_user_type_idx on public.categories(user_id, type);
create index goals_user_idx on public.goals(user_id);
