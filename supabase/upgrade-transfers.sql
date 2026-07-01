create extension if not exists "pgcrypto";

insert into public.profiles (id, full_name)
values ('main', 'Gonçalo')
on conflict (id) do update set full_name = excluded.full_name;

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default 'main' references public.profiles(id) on delete cascade,
  name text not null,
  type text not null default 'bank',
  balance numeric(12, 2) not null default 0,
  currency text not null default 'EUR',
  created_at timestamptz not null default now()
);

alter table public.accounts add column if not exists user_id text not null default 'main';
alter table public.accounts add column if not exists type text not null default 'bank';
alter table public.accounts add column if not exists balance numeric(12, 2) not null default 0;
alter table public.accounts add column if not exists currency text not null default 'EUR';
alter table public.accounts add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'accounts_user_id_name_key'
      and conrelid = 'public.accounts'::regclass
  ) then
    alter table public.accounts add constraint accounts_user_id_name_key unique (user_id, name);
  end if;
end $$;

insert into public.accounts (user_id, name, type, balance, currency)
values
  ('main', 'Millennium', 'bank', 0, 'EUR'),
  ('main', 'Revolut', 'wallet', 0, 'EUR'),
  ('main', 'Dinheiro', 'cash', 0, 'EUR')
on conflict (user_id, name) do nothing;

alter table public.transactions add column if not exists account_id uuid;
alter table public.transactions add column if not exists from_account_id uuid;
alter table public.transactions add column if not exists to_account_id uuid;
alter table public.transactions add column if not exists include_in_monthly_summary boolean;
alter table public.transactions add column if not exists updated_at timestamptz default now();

update public.transactions
set include_in_monthly_summary = case
  when type in ('income', 'expense') then true
  else false
end
where include_in_monthly_summary is null;

alter table public.transactions
  alter column include_in_monthly_summary set default true,
  alter column include_in_monthly_summary set not null;

update public.transactions
set account_id = (
  select id from public.accounts
  where user_id = 'main' and name = 'Millennium'
  limit 1
)
where type in ('income', 'expense')
  and account_id is null;

do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select conname
    from pg_constraint
    where conrelid = 'public.transactions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%type%'
  loop
    execute format('alter table public.transactions drop constraint %I', constraint_row.conname);
  end loop;
end $$;

alter table public.transactions
  add constraint transactions_type_check
  check (type in ('income', 'expense', 'transfer', 'third_party', 'investment', 'reimbursable'));

do $$
begin
  alter table public.transactions drop constraint if exists transaction_shape;

  alter table public.transactions
    add constraint transaction_shape check (
      (
        type in ('income', 'expense', 'third_party', 'investment', 'reimbursable')
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
    );
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'transactions_account_id_fkey'
      and conrelid = 'public.transactions'::regclass
  ) then
    alter table public.transactions
      add constraint transactions_account_id_fkey
      foreign key (account_id) references public.accounts(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'transactions_from_account_id_fkey'
      and conrelid = 'public.transactions'::regclass
  ) then
    alter table public.transactions
      add constraint transactions_from_account_id_fkey
      foreign key (from_account_id) references public.accounts(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'transactions_to_account_id_fkey'
      and conrelid = 'public.transactions'::regclass
  ) then
    alter table public.transactions
      add constraint transactions_to_account_id_fkey
      foreign key (to_account_id) references public.accounts(id) on delete set null;
  end if;
end $$;

alter table public.accounts enable row level security;

drop policy if exists "shared_accounts_read" on public.accounts;
drop policy if exists "shared_accounts_insert" on public.accounts;
drop policy if exists "shared_accounts_update" on public.accounts;
drop policy if exists "shared_accounts_delete" on public.accounts;

create policy "shared_accounts_read" on public.accounts for select to anon using (user_id = 'main');
create policy "shared_accounts_insert" on public.accounts for insert to anon with check (user_id = 'main');
create policy "shared_accounts_update" on public.accounts for update to anon using (user_id = 'main') with check (user_id = 'main');
create policy "shared_accounts_delete" on public.accounts for delete to anon using (user_id = 'main');

create index if not exists accounts_user_idx on public.accounts(user_id);
create index if not exists transactions_account_idx on public.transactions(user_id, account_id);
create index if not exists transactions_from_account_idx on public.transactions(user_id, from_account_id);
create index if not exists transactions_to_account_idx on public.transactions(user_id, to_account_id);

create table if not exists public.transaction_rules (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default 'main' references public.profiles(id) on delete cascade,
  merchant_pattern text not null,
  transaction_type text not null check (transaction_type in ('income', 'expense', 'transfer', 'third_party', 'investment', 'reimbursable')),
  category_id uuid references public.categories(id) on delete set null,
  include_in_monthly_summary boolean not null default true,
  confidence integer not null default 96 check (confidence >= 0 and confidence <= 100),
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'transaction_rules_user_id_merchant_pattern_key'
      and conrelid = 'public.transaction_rules'::regclass
  ) then
    alter table public.transaction_rules add constraint transaction_rules_user_id_merchant_pattern_key unique (user_id, merchant_pattern);
  end if;
end $$;

alter table public.transaction_rules add column if not exists include_in_monthly_summary boolean;

update public.transaction_rules
set include_in_monthly_summary = case
  when transaction_type in ('income', 'expense') then true
  else false
end
where include_in_monthly_summary is null;

alter table public.transaction_rules
  alter column include_in_monthly_summary set default true,
  alter column include_in_monthly_summary set not null;

alter table public.transaction_rules
  drop constraint if exists transaction_rules_transaction_type_check;

alter table public.transaction_rules
  add constraint transaction_rules_transaction_type_check
  check (transaction_type in ('income', 'expense', 'transfer', 'third_party', 'investment', 'reimbursable'));

alter table public.transaction_rules enable row level security;

drop policy if exists "shared_transaction_rules_read" on public.transaction_rules;
drop policy if exists "shared_transaction_rules_insert" on public.transaction_rules;
drop policy if exists "shared_transaction_rules_update" on public.transaction_rules;
drop policy if exists "shared_transaction_rules_delete" on public.transaction_rules;

create policy "shared_transaction_rules_read" on public.transaction_rules for select to anon using (user_id = 'main');
create policy "shared_transaction_rules_insert" on public.transaction_rules for insert to anon with check (user_id = 'main');
create policy "shared_transaction_rules_update" on public.transaction_rules for update to anon using (user_id = 'main') with check (user_id = 'main');
create policy "shared_transaction_rules_delete" on public.transaction_rules for delete to anon using (user_id = 'main');

create index if not exists transaction_rules_user_idx on public.transaction_rules(user_id);
create index if not exists transaction_rules_pattern_idx on public.transaction_rules(user_id, merchant_pattern);
