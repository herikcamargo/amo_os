-- AMO OS - SQL unico incremental para Supabase.
-- Pode ser colado no SQL Editor do Supabase em um projeto que ja tem as tabelas principais do Amo OS.

create extension if not exists "uuid-ossp";
create extension if not exists pg_trgm;

create table if not exists public.price_catalog (
  id text primary key,
  brand text not null,
  model text not null,
  search text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.price_services (
  id uuid primary key default uuid_generate_v4(),
  catalog_id text not null references public.price_catalog(id) on delete cascade,
  key text not null,
  label text not null,
  source_label text,
  quality text,
  final_price numeric,
  installment_price numeric,
  cost_price numeric,
  note text
);

alter table public.price_catalog
  add column if not exists search text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.price_services
  add column if not exists catalog_id text,
  add column if not exists key text,
  add column if not exists label text,
  add column if not exists source_label text,
  add column if not exists quality text,
  add column if not exists final_price numeric,
  add column if not exists installment_price numeric,
  add column if not exists cost_price numeric,
  add column if not exists note text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'price_services_catalog_id_key_key'
      and conrelid = 'public.price_services'::regclass
  ) then
    alter table public.price_services
      add constraint price_services_catalog_id_key_key unique (catalog_id, key);
  end if;
end $$;

create index if not exists idx_price_catalog_brand on public.price_catalog (brand);
create index if not exists idx_price_catalog_search on public.price_catalog using gin (search gin_trgm_ops);
create index if not exists idx_price_services_catalog on public.price_services (catalog_id);

create table if not exists public.pricing_config (
  id text primary key default 'default',
  attendant_discount_limit_pct numeric not null default 5,
  card_installment_fee_pct numeric not null default 11,
  max_installments integer not null default 10,
  updated_at timestamptz not null default now()
);

alter table public.pricing_config
  add column if not exists attendant_discount_limit_pct numeric not null default 5,
  add column if not exists card_installment_fee_pct numeric not null default 11,
  add column if not exists max_installments integer not null default 10,
  add column if not exists updated_at timestamptz not null default now();

insert into public.pricing_config (id, attendant_discount_limit_pct, card_installment_fee_pct, max_installments)
values ('default', 5, 11, 10)
on conflict (id) do nothing;

update public.pricing_config
set card_installment_fee_pct = 11
where id = 'default' and coalesce(card_installment_fee_pct, 0) in (0, 5);

update public.pricing_config
set max_installments = 10
where id = 'default' and coalesce(max_installments, 0) in (0, 12);

alter table public.app_settings
  add column if not exists os_entry_terms text not null default 'Cliente autoriza a abertura, analise tecnica e orcamento do aparelho. A AmoCelular nao se responsabiliza por dados sem backup previo.',
  add column if not exists os_exit_terms text not null default 'Cliente declara que conferiu o aparelho, recebeu orientacoes e esta de acordo com os servicos realizados e condicoes de garantia.';

insert into public.app_settings (id)
values ('default')
on conflict (id) do nothing;

alter table public.sale_devices
  add column if not exists product_category text not null default 'celular',
  add column if not exists sku text,
  add column if not exists barcode text,
  add column if not exists stock_quantity integer not null default 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sale_devices_product_category_check'
      and conrelid = 'public.sale_devices'::regclass
  ) then
    alter table public.sale_devices
      add constraint sale_devices_product_category_check
      check (product_category in ('celular', 'carregador', 'pelicula', 'capa', 'acessorio', 'outro'));
  end if;
end $$;

alter table public.device_sales
  add column if not exists quantity integer not null default 1;

create index if not exists idx_sale_devices_category on public.sale_devices(product_category);
create index if not exists idx_sale_devices_sku on public.sale_devices(sku);
create index if not exists idx_sale_devices_barcode on public.sale_devices(barcode);

alter table public.price_catalog enable row level security;
alter table public.price_services enable row level security;
alter table public.pricing_config enable row level security;

drop policy if exists "auth_read" on public.price_catalog;
create policy "auth_read" on public.price_catalog for select using (auth.role() = 'authenticated');
drop policy if exists "auth_write" on public.price_catalog;
create policy "auth_write" on public.price_catalog for all using (auth.role() = 'authenticated');

drop policy if exists "auth_read" on public.price_services;
create policy "auth_read" on public.price_services for select using (auth.role() = 'authenticated');
drop policy if exists "auth_write" on public.price_services;
create policy "auth_write" on public.price_services for all using (auth.role() = 'authenticated');

drop policy if exists "auth_read" on public.pricing_config;
create policy "auth_read" on public.pricing_config for select using (auth.role() = 'authenticated');
drop policy if exists "auth_write" on public.pricing_config;
create policy "auth_write" on public.pricing_config for all using (auth.role() = 'authenticated');
