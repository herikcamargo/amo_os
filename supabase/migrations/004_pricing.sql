create table if not exists public.price_overrides (
  item_id text not null,
  service_key text not null,
  cost_price numeric,
  final_price numeric,
  updated_by uuid references public.users(id),
  updated_at timestamptz default now(),
  primary key (item_id, service_key)
);

create table if not exists public.pricing_settings (
  id text primary key default 'default',
  attendant_discount_limit_pct numeric not null default 5,
  card_installment_fee_pct numeric not null default 11,
  max_installments integer not null default 10,
  updated_by uuid references public.users(id),
  updated_at timestamptz default now()
);

alter table public.pricing_settings
add column if not exists max_installments integer not null default 10;

alter table public.pricing_settings
alter column card_installment_fee_pct set default 11;

update public.pricing_settings
set card_installment_fee_pct = 11,
    max_installments = 10
where id = 'default'
  and card_installment_fee_pct = 12;

insert into public.pricing_settings (id)
values ('default')
on conflict (id) do nothing;

alter table public.price_overrides enable row level security;
alter table public.pricing_settings enable row level security;

drop policy if exists "authenticated_read_price_overrides" on public.price_overrides;
create policy "authenticated_read_price_overrides"
on public.price_overrides for select
using (auth.role() = 'authenticated');

drop policy if exists "admin_manage_price_overrides" on public.price_overrides;
create policy "admin_manage_price_overrides"
on public.price_overrides for all
using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
)
with check (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
);

drop policy if exists "authenticated_read_pricing_settings" on public.pricing_settings;
create policy "authenticated_read_pricing_settings"
on public.pricing_settings for select
using (auth.role() = 'authenticated');

drop policy if exists "admin_manage_pricing_settings" on public.pricing_settings;
create policy "admin_manage_pricing_settings"
on public.pricing_settings for all
using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
)
with check (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
);
