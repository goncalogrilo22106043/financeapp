alter table public.transactions
  add column if not exists include_in_monthly_summary boolean;

update public.transactions
set include_in_monthly_summary = case
  when type in ('income', 'expense') then true
  else false
end
where include_in_monthly_summary is null;

alter table public.transactions
  alter column include_in_monthly_summary set default true,
  alter column include_in_monthly_summary set not null;

alter table public.transactions
  drop constraint if exists transactions_type_check;

alter table public.transactions
  add constraint transactions_type_check
  check (type in ('income', 'expense', 'transfer', 'third_party', 'investment', 'reimbursable'));

alter table public.transactions
  drop constraint if exists transaction_shape;

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

alter table public.transaction_rules
  add column if not exists include_in_monthly_summary boolean;

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
