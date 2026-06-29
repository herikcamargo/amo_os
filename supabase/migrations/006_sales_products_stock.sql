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
