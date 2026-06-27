create extension if not exists "pgcrypto";

drop table if exists public.transactions;
drop table if exists public.categories;
drop table if exists public.goals;
drop table if exists public.profiles;

create table public.profiles (
  id text primary key default 'main',
  full_name text,
  created_at timestamptz not null default now()
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
  type text not null check (type in ('income', 'expense')),
  amount numeric(12, 2) not null check (amount >= 0),
  category_id uuid references public.categories(id) on delete set null,
  description text,
  payment_method text,
  date date not null,
  created_at timestamptz not null default now()
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default 'main' references public.profiles(id) on delete cascade,
  title text not null,
  target_amount numeric(12, 2) not null check (target_amount >= 0),
  current_amount numeric(12, 2) not null default 0 check (current_amount >= 0),
  created_at timestamptz not null default now()
);

insert into public.profiles (id, full_name)
values ('main', 'Gonçalo')
on conflict (id) do update set full_name = excluded.full_name;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.goals enable row level security;

create policy "shared_profile_read"
on public.profiles for select
to anon
using (id = 'main');

create policy "shared_profile_write"
on public.profiles for insert
to anon
with check (id = 'main');

create policy "shared_profile_update"
on public.profiles for update
to anon
using (id = 'main')
with check (id = 'main');

create policy "shared_categories_read"
on public.categories for select
to anon
using (user_id = 'main');

create policy "shared_categories_insert"
on public.categories for insert
to anon
with check (user_id = 'main');

create policy "shared_categories_update"
on public.categories for update
to anon
using (user_id = 'main')
with check (user_id = 'main');

create policy "shared_categories_delete"
on public.categories for delete
to anon
using (user_id = 'main');

create policy "shared_transactions_read"
on public.transactions for select
to anon
using (user_id = 'main');

create policy "shared_transactions_insert"
on public.transactions for insert
to anon
with check (user_id = 'main');

create policy "shared_transactions_update"
on public.transactions for update
to anon
using (user_id = 'main')
with check (user_id = 'main');

create policy "shared_transactions_delete"
on public.transactions for delete
to anon
using (user_id = 'main');

create policy "shared_goals_read"
on public.goals for select
to anon
using (user_id = 'main');

create policy "shared_goals_insert"
on public.goals for insert
to anon
with check (user_id = 'main');

create policy "shared_goals_update"
on public.goals for update
to anon
using (user_id = 'main')
with check (user_id = 'main');

create policy "shared_goals_delete"
on public.goals for delete
to anon
using (user_id = 'main');

create index transactions_user_date_idx on public.transactions(user_id, date desc);
create index categories_user_type_idx on public.categories(user_id, type);
create index goals_user_idx on public.goals(user_id);
