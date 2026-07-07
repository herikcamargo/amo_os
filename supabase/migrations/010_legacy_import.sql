-- Suporte a migração de dados do sistema antigo (FPQ System)
-- Aditivo apenas: novas colunas nullable + tabela de auditoria.
-- Nao altera nem remove nada do schema existente.

-- Rastreia o codigo do cliente no sistema antigo, permite reimport idempotente
alter table public.customers
  add column if not exists legacy_system text,
  add column if not exists legacy_cod text;

create unique index if not exists idx_customers_legacy_cod
  on public.customers (legacy_system, legacy_cod)
  where legacy_cod is not null;

-- Guarda dados do sistema antigo que nao tem campo equivalente no schema novo
-- (tecnico responsavel, situacao textual original, motivo de fechamento/cancelamento)
alter table public.service_orders
  add column if not exists legacy_system text,
  add column if not exists legacy_data jsonb;

create index if not exists idx_service_orders_legacy_system
  on public.service_orders (legacy_system)
  where legacy_system is not null;

-- Log de execucoes de import, para auditoria e para saber o que ja rodou
create table if not exists public.legacy_import_log (
  id uuid primary key default gen_random_uuid(),
  source_system text not null,
  entity text not null,
  total_source integer not null default 0,
  inserted integer not null default 0,
  updated integer not null default 0,
  skipped integer not null default 0,
  notes text,
  run_at timestamptz not null default now(),
  run_by text
);

alter table public.legacy_import_log enable row level security;

drop policy if exists "auth_read" on public.legacy_import_log;
create policy "auth_read" on public.legacy_import_log for select using (auth.role() = 'authenticated');
drop policy if exists "auth_write" on public.legacy_import_log;
create policy "auth_write" on public.legacy_import_log for all using (auth.role() = 'authenticated');

select 'Migration 010 (legacy import) executada com sucesso!' as status;
