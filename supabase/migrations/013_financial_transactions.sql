create table if not exists public.financial_transactions (
  id uuid primary key default uuid_generate_v4(),
  type text not null check (type in ('entrada', 'saida')),
  category text not null,
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null,
  account text not null,
  transaction_date timestamptz not null default now(),
  notes text,
  source_type text,
  source_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.users(id)
);

create index if not exists idx_financial_transactions_date
  on public.financial_transactions (transaction_date desc);
create index if not exists idx_financial_transactions_type
  on public.financial_transactions (type);
create index if not exists idx_financial_transactions_category
  on public.financial_transactions (category);
create index if not exists idx_financial_transactions_source
  on public.financial_transactions (source_type, source_id);

alter table public.financial_transactions enable row level security;

drop policy if exists "admin_read" on public.financial_transactions;
drop policy if exists "admin_insert" on public.financial_transactions;
drop policy if exists "admin_update" on public.financial_transactions;
drop policy if exists "admin_delete" on public.financial_transactions;

create policy "admin_read" on public.financial_transactions
  for select using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin' and ativo = true)
  );
create policy "admin_insert" on public.financial_transactions
  for insert with check (
    created_by = auth.uid()
    and exists (select 1 from public.users where id = auth.uid() and role = 'admin' and ativo = true)
  );
create policy "admin_update" on public.financial_transactions
  for update using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin' and ativo = true)
  );
create policy "admin_delete" on public.financial_transactions
  for delete using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin' and ativo = true)
  );
