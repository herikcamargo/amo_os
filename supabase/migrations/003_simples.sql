-- ═══════════════════════════════════════════════════════════════
-- AMO OS — Migration SIMPLES (testada no SQL Editor)
-- Cole TUDO de uma vez no SQL Editor e clique RUN
-- ═══════════════════════════════════════════════════════════════

-- ENUMS
do $$ begin
  create type user_role as enum ('admin', 'atendente', 'tecnico');
exception when duplicate_object then null; end $$;

do $$ begin
  create type os_status as enum ('recebido','analise','aprovacao','peca','manutencao','pronto','entregue','cancelado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type checklist_kind as enum ('entrada','saida');
exception when duplicate_object then null; end $$;

-- USERS
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text unique not null,
  role user_role not null default 'atendente',
  telefone text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- CUSTOMERS
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text not null,
  cpf text,
  created_at timestamptz not null default now()
);

-- DEVICES
create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  marca text,
  modelo text,
  cor text,
  imei text,
  senha_desbloqueio text,
  acessorios text[] default '{}',
  created_at timestamptz not null default now()
);

-- SERVICE ORDERS
create sequence if not exists os_seq start 1;

create table if not exists public.service_orders (
  id uuid primary key default gen_random_uuid(),
  numero text unique,
  customer_id uuid references public.customers(id) on delete set null,
  device_id uuid references public.devices(id) on delete set null,
  status os_status not null default 'recebido',
  problema_relatado text,
  condicao_estetica jsonb default '{}',
  diagnostico text,
  servico_executado text,
  pecas_utilizadas text,
  valor_servico numeric(10,2) default 0,
  garantia_dias int default 0,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Trigger numero AMO-YYYY-NNNNNN
create or replace function gen_os_numero() returns trigger as $$
begin
  if new.numero is null then
    new.numero := 'AMO-' || to_char(now(),'YYYY') || '-' || lpad(nextval('os_seq')::text, 6, '0');
  end if;
  return new;
end; $$ language plpgsql;

drop trigger if exists trg_os_numero on public.service_orders;
create trigger trg_os_numero before insert on public.service_orders
  for each row execute function gen_os_numero();

-- Trigger updated_at
create or replace function touch_updated_at() returns trigger as $$
begin new.updated_at := now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_os_touch on public.service_orders;
create trigger trg_os_touch before update on public.service_orders
  for each row execute function touch_updated_at();

-- CHECKLISTS
create table if not exists public.service_order_checklists (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid references public.service_orders(id) on delete cascade,
  kind checklist_kind not null,
  itens jsonb not null default '{}',
  observacoes text,
  created_at timestamptz not null default now()
);

-- PHOTOS
create table if not exists public.service_order_photos (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid references public.service_orders(id) on delete cascade,
  kind checklist_kind not null,
  storage_path text not null,
  legenda text,
  created_at timestamptz not null default now()
);

-- LOGS
create table if not exists public.service_order_logs (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid references public.service_orders(id) on delete cascade,
  user_id uuid references public.users(id),
  alteracao text not null,
  created_at timestamptz not null default now()
);

-- REMINDERS
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid references public.service_orders(id) on delete cascade,
  tipo text not null,
  enviado boolean not null default false,
  enviado_at timestamptz,
  dias_limite int not null default 7,
  created_at timestamptz not null default now()
);

-- RLS — politica permissiva para autenticados
alter table public.users enable row level security;
alter table public.customers enable row level security;
alter table public.devices enable row level security;
alter table public.service_orders enable row level security;
alter table public.service_order_checklists enable row level security;
alter table public.service_order_photos enable row level security;
alter table public.service_order_logs enable row level security;
alter table public.reminders enable row level security;

-- Politicas: autenticados podem tudo (refinar depois)
drop policy if exists "auth_all" on public.users;
create policy "auth_all" on public.users for all using (auth.role() = 'authenticated');

drop policy if exists "auth_all" on public.customers;
create policy "auth_all" on public.customers for all using (auth.role() = 'authenticated');

drop policy if exists "auth_all" on public.devices;
create policy "auth_all" on public.devices for all using (auth.role() = 'authenticated');

drop policy if exists "auth_all" on public.service_orders;
create policy "auth_all" on public.service_orders for all using (auth.role() = 'authenticated');

drop policy if exists "auth_all" on public.service_order_checklists;
create policy "auth_all" on public.service_order_checklists for all using (auth.role() = 'authenticated');

drop policy if exists "auth_all" on public.service_order_photos;
create policy "auth_all" on public.service_order_photos for all using (auth.role() = 'authenticated');

drop policy if exists "auth_all" on public.service_order_logs;
create policy "auth_all" on public.service_order_logs for all using (auth.role() = 'authenticated');

drop policy if exists "auth_all" on public.reminders;
create policy "auth_all" on public.reminders for all using (auth.role() = 'authenticated');

-- VIEW combinando OS + cliente + aparelho
create or replace view public.v_service_orders as
select
  so.*,
  c.nome as cliente_nome,
  c.telefone as cliente_telefone,
  c.cpf as cliente_cpf,
  d.marca as device_marca,
  d.modelo as device_modelo,
  d.cor as device_cor,
  d.imei as device_imei,
  d.acessorios as device_acessorios
from public.service_orders so
left join public.customers c on c.id = so.customer_id
left join public.devices d on d.id = so.device_id;

-- View de OS prontas pendentes
create or replace view public.v_os_prontas_pendentes as
select
  so.id,
  so.numero,
  so.updated_at,
  extract(day from now() - so.updated_at)::int as dias_pronto,
  c.nome as cliente_nome,
  c.telefone as cliente_telefone,
  d.modelo as device_modelo
from public.service_orders so
join public.customers c on c.id = so.customer_id
join public.devices d on d.id = so.device_id
where so.status = 'pronto'
  and extract(day from now() - so.updated_at) >= 3
order by so.updated_at asc;

-- Pronto. Tabelas criadas.
select 'AMO OS — banco criado com sucesso!' as status;
