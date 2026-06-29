alter table public.customers
  add column if not exists cep text,
  add column if not exists logradouro text,
  add column if not exists numero text,
  add column if not exists complemento text,
  add column if not exists bairro text,
  add column if not exists cidade text,
  add column if not exists uf text;

alter table public.service_orders
  add column if not exists part_warranty jsonb,
  add column if not exists delivery_terms text,
  add column if not exists delivery_notes text,
  add column if not exists delivery_responsible text,
  add column if not exists payment_method text,
  add column if not exists payment_status text,
  add column if not exists printed_entrada_at timestamptz,
  add column if not exists printed_saida_at timestamptz;

create table if not exists public.suppliers (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  nome_fantasia text,
  documento text,
  telefone text,
  whatsapp text,
  email text,
  observacoes text,
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sale_devices (
  id uuid primary key default uuid_generate_v4(),
  photo_url text,
  tipo text not null check (tipo in ('novo', 'seminovo', 'usado')),
  marca text not null,
  modelo text not null,
  cor text,
  armazenamento text,
  memoria_ram text,
  imei1 text unique,
  imei2 text unique,
  serial text unique,
  custo_compra numeric not null default 0,
  preco_venda numeric not null default 0,
  supplier_id uuid references public.suppliers(id),
  data_compra date,
  condicao text,
  acessorios text,
  garantia text,
  observacoes text,
  status text not null default 'disponivel' check (status in ('disponivel', 'reservado', 'vendido', 'cancelado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.device_sales (
  id uuid primary key default uuid_generate_v4(),
  numero text not null unique,
  customer_id uuid not null references public.customers(id),
  device_id uuid not null references public.sale_devices(id),
  seller_id uuid references public.users(id),
  sold_at timestamptz not null default now(),
  preco_original numeric not null default 0,
  desconto numeric not null default 0,
  acrescimo numeric not null default 0,
  valor_final numeric not null default 0,
  forma_pagamento text not null,
  parcelas integer not null default 1,
  valor_entrada numeric not null default 0,
  financeira text,
  observacoes text,
  cancel_reason text,
  cancelled_at timestamptz,
  fiscal jsonb not null default '{"status":"nao_solicitado"}'::jsonb
);

create unique index if not exists one_active_sale_per_device
  on public.device_sales(device_id)
  where cancelled_at is null;

create table if not exists public.audit_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id),
  user_name text,
  action text not null,
  entity text not null,
  entity_id text not null,
  previous_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  id text primary key default 'default',
  warranty_terms text not null default 'A garantia cobre exclusivamente o servico realizado e as pecas substituidas, respeitando mau uso, queda, oxidacao e violacao do aparelho.',
  sale_terms text not null default 'Declaro estar ciente das condicoes do aparelho, garantia informada e forma de pagamento registrada neste recibo.',
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id)
values ('default')
on conflict (id) do nothing;

alter table public.suppliers enable row level security;
alter table public.sale_devices enable row level security;
alter table public.device_sales enable row level security;
alter table public.audit_logs enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists "authenticated_read" on public.suppliers;
drop policy if exists "authenticated_read" on public.sale_devices;
drop policy if exists "authenticated_read" on public.device_sales;
drop policy if exists "authenticated_read" on public.audit_logs;
drop policy if exists "authenticated_read" on public.app_settings;

create policy "authenticated_read" on public.suppliers for select using (auth.role() = 'authenticated');
create policy "authenticated_read" on public.sale_devices for select using (auth.role() = 'authenticated');
create policy "authenticated_read" on public.device_sales for select using (auth.role() = 'authenticated');
create policy "authenticated_read" on public.audit_logs for select using (auth.role() = 'authenticated');
create policy "authenticated_read" on public.app_settings for select using (auth.role() = 'authenticated');

drop policy if exists "authenticated_write" on public.suppliers;
drop policy if exists "authenticated_update" on public.suppliers;
drop policy if exists "authenticated_write" on public.sale_devices;
drop policy if exists "authenticated_update" on public.sale_devices;
drop policy if exists "authenticated_write" on public.device_sales;
drop policy if exists "authenticated_update" on public.device_sales;
drop policy if exists "authenticated_write" on public.audit_logs;
drop policy if exists "authenticated_update" on public.app_settings;

create policy "authenticated_write" on public.suppliers for insert with check (auth.role() = 'authenticated');
create policy "authenticated_update" on public.suppliers for update using (auth.role() = 'authenticated');
create policy "authenticated_write" on public.sale_devices for insert with check (auth.role() = 'authenticated');
create policy "authenticated_update" on public.sale_devices for update using (auth.role() = 'authenticated');
create policy "authenticated_write" on public.device_sales for insert with check (auth.role() = 'authenticated');
create policy "authenticated_update" on public.device_sales for update using (auth.role() = 'authenticated');
create policy "authenticated_write" on public.audit_logs for insert with check (auth.role() = 'authenticated');
create policy "authenticated_update" on public.app_settings for update using (auth.role() = 'authenticated');

create or replace view public.v_service_orders as
select
  so.*,
  c.nome as cliente_nome,
  c.telefone as cliente_telefone,
  c.cpf as cliente_cpf,
  c.cep as cliente_cep,
  c.logradouro as cliente_logradouro,
  c.numero as cliente_numero,
  c.complemento as cliente_complemento,
  c.bairro as cliente_bairro,
  c.cidade as cliente_cidade,
  c.uf as cliente_uf,
  d.marca as device_marca,
  d.modelo as device_modelo,
  d.cor as device_cor,
  d.imei as device_imei,
  d.acessorios as device_acessorios
from public.service_orders so
join public.customers c on c.id = so.customer_id
join public.devices d on d.id = so.device_id;
