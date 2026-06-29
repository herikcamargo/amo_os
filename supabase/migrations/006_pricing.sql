create extension if not exists pg_trgm;

create table if not exists public.price_catalog (
  id text primary key,
  brand text not null,
  model text not null,
  search text not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_price_catalog_brand on public.price_catalog (brand);
create index if not exists idx_price_catalog_search on public.price_catalog using gin (search gin_trgm_ops);

create table if not exists public.price_services (
  id uuid primary key default gen_random_uuid(),
  catalog_id text not null references public.price_catalog(id) on delete cascade,
  key text not null,
  label text not null,
  source_label text,
  quality text,
  final_price numeric,
  installment_price numeric,
  cost_price numeric,
  note text,
  unique(catalog_id, key)
);

create index if not exists idx_price_services_catalog on public.price_services (catalog_id);

create table if not exists public.pricing_config (
  id text primary key default 'default',
  attendant_discount_limit_pct numeric not null default 5,
  card_installment_fee_pct numeric not null default 5,
  max_installments integer not null default 12,
  updated_at timestamptz not null default now()
);

insert into public.pricing_config (id) values ('default') on conflict (id) do nothing;

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
