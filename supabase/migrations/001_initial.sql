-- ═══════════════════════════════════════════════════════════════
-- AMO OS — Migration inicial
-- AmoCelular · Araraquara/SP
-- ═══════════════════════════════════════════════════════════════

-- ───────────── EXTENSÕES ─────────────
create extension if not exists "uuid-ossp";

-- ───────────── ENUMS ─────────────
create type user_role as enum ('admin', 'atendente', 'tecnico');
create type os_status as enum (
  'recebido','analise','aprovacao','peca','manutencao','pronto','entregue','cancelado'
);
create type checklist_kind as enum ('entrada','saida');

-- ───────────── USERS (perfil liga ao auth.users) ─────────────
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text unique not null,
  role user_role not null default 'atendente',
  telefone text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ───────────── CUSTOMERS ─────────────
create table public.customers (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  telefone text not null,
  cpf text,
  created_at timestamptz not null default now()
);
create index idx_customers_telefone on public.customers (telefone);
create index idx_customers_nome on public.customers (nome);

-- ───────────── DEVICES ─────────────
create table public.devices (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid references public.customers(id) on delete set null,
  marca text,
  modelo text,
  cor text,
  imei text,
  senha_desbloqueio text,
  acessorios text[] default '{}',
  created_at timestamptz not null default now()
);
create index idx_devices_imei on public.devices (imei);

-- ───────────── SERVICE ORDERS ─────────────
create sequence if not exists os_seq start 1;

create table public.service_orders (
  id uuid primary key default uuid_generate_v4(),
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
create index idx_so_status on public.service_orders (status);
create index idx_so_numero on public.service_orders (numero);
create index idx_so_created_at on public.service_orders (created_at desc);

-- Trigger: gerar número AMO-YYYY-NNNNNN automaticamente
create or replace function gen_os_numero() returns trigger as $$
begin
  if new.numero is null then
    new.numero := 'AMO-' || to_char(now(),'YYYY') || '-' ||
                  lpad(nextval('os_seq')::text, 6, '0');
  end if;
  return new;
end; $$ language plpgsql;

create trigger trg_os_numero before insert on public.service_orders
  for each row execute function gen_os_numero();

-- Trigger: atualizar updated_at automaticamente
create or replace function touch_updated_at() returns trigger as $$
begin new.updated_at := now(); return new; end; $$ language plpgsql;

create trigger trg_os_touch before update on public.service_orders
  for each row execute function touch_updated_at();

-- ───────────── CHECKLISTS (entrada/saída) ─────────────
create table public.service_order_checklists (
  id uuid primary key default uuid_generate_v4(),
  service_order_id uuid references public.service_orders(id) on delete cascade,
  kind checklist_kind not null,
  itens jsonb not null default '{}',
  observacoes text,
  created_at timestamptz not null default now()
);
create index idx_soc_so on public.service_order_checklists (service_order_id);

-- ───────────── PHOTOS ─────────────
create table public.service_order_photos (
  id uuid primary key default uuid_generate_v4(),
  service_order_id uuid references public.service_orders(id) on delete cascade,
  kind checklist_kind not null,
  storage_path text not null,
  legenda text,
  created_at timestamptz not null default now()
);
create index idx_sop_so on public.service_order_photos (service_order_id);

-- ───────────── LOGS ─────────────
create table public.service_order_logs (
  id uuid primary key default uuid_generate_v4(),
  service_order_id uuid references public.service_orders(id) on delete cascade,
  user_id uuid references public.users(id),
  alteracao text not null,
  created_at timestamptz not null default now()
);
create index idx_sol_so on public.service_order_logs (service_order_id);

-- ───────────── WARRANTIES ─────────────
create table public.warranties (
  id uuid primary key default uuid_generate_v4(),
  service_order_id uuid references public.service_orders(id) on delete cascade,
  inicio date not null default current_date,
  dias int not null,
  fim date generated always as (inicio + dias) stored,
  created_at timestamptz not null default now()
);

-- ───────────── REMINDERS (lembretes ativos) ─────────────
create table public.reminders (
  id uuid primary key default uuid_generate_v4(),
  service_order_id uuid references public.service_orders(id) on delete cascade,
  tipo text not null,              -- 'pronto_sem_retirada', 'aprovacao_pendente', etc.
  enviado boolean not null default false,
  enviado_at timestamptz,
  dias_limite int not null default 7,
  created_at timestamptz not null default now()
);
create index idx_reminders_so on public.reminders (service_order_id);
create index idx_reminders_enviado on public.reminders (enviado) where not enviado;

-- ───────────── WHATSAPP REPORT LOG ─────────────
create table public.whatsapp_report_logs (
  id uuid primary key default uuid_generate_v4(),
  tipo text not null,              -- 'diario' ou 'semanal'
  destinatario text not null,      -- telefone do admin
  conteudo text not null,
  enviado boolean not null default false,
  erro text,
  created_at timestamptz not null default now()
);

-- ───────────── RLS ─────────────
alter table public.users                     enable row level security;
alter table public.customers                 enable row level security;
alter table public.devices                   enable row level security;
alter table public.service_orders            enable row level security;
alter table public.service_order_checklists  enable row level security;
alter table public.service_order_photos      enable row level security;
alter table public.service_order_logs        enable row level security;
alter table public.warranties                enable row level security;
alter table public.reminders                 enable row level security;
alter table public.whatsapp_report_logs      enable row level security;

-- Política: qualquer autenticado lê tudo (app interno)
create policy "authenticated_read" on public.users for select using (auth.role() = 'authenticated');
create policy "authenticated_read" on public.customers for select using (auth.role() = 'authenticated');
create policy "authenticated_read" on public.devices for select using (auth.role() = 'authenticated');
create policy "authenticated_read" on public.service_orders for select using (auth.role() = 'authenticated');
create policy "authenticated_read" on public.service_order_checklists for select using (auth.role() = 'authenticated');
create policy "authenticated_read" on public.service_order_photos for select using (auth.role() = 'authenticated');
create policy "authenticated_read" on public.service_order_logs for select using (auth.role() = 'authenticated');
create policy "authenticated_read" on public.warranties for select using (auth.role() = 'authenticated');
create policy "authenticated_read" on public.reminders for select using (auth.role() = 'authenticated');
create policy "authenticated_read" on public.whatsapp_report_logs for select using (auth.role() = 'authenticated');

-- Insert/update: autenticados podem inserir e atualizar
create policy "authenticated_write" on public.customers for insert with check (auth.role() = 'authenticated');
create policy "authenticated_update" on public.customers for update using (auth.role() = 'authenticated');
create policy "authenticated_write" on public.devices for insert with check (auth.role() = 'authenticated');
create policy "authenticated_update" on public.devices for update using (auth.role() = 'authenticated');
create policy "authenticated_write" on public.service_orders for insert with check (auth.role() = 'authenticated');
create policy "authenticated_update" on public.service_orders for update using (auth.role() = 'authenticated');
create policy "authenticated_write" on public.service_order_checklists for insert with check (auth.role() = 'authenticated');
create policy "authenticated_write" on public.service_order_photos for insert with check (auth.role() = 'authenticated');
create policy "authenticated_write" on public.service_order_logs for insert with check (auth.role() = 'authenticated');
create policy "authenticated_write" on public.warranties for insert with check (auth.role() = 'authenticated');
create policy "authenticated_write" on public.reminders for insert with check (auth.role() = 'authenticated');
create policy "authenticated_update" on public.reminders for update using (auth.role() = 'authenticated');

-- Admin-only: whatsapp_report_logs e delete de users
create policy "admin_write" on public.whatsapp_report_logs for insert with check (auth.role() = 'authenticated');
create policy "admin_manage_users" on public.users for all using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
);

-- ───────────── STORAGE BUCKET ─────────────
-- Executar manualmente no dashboard do Supabase:
-- Criar bucket "os-fotos" (público: false)
-- Policy: autenticados podem upload/download

-- ───────────── VIEW: OS com dados do cliente e aparelho ─────────────
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

-- ───────────── VIEW: OS prontas sem retirada (para lembretes) ─────────────
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
