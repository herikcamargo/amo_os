alter table public.service_orders
  add column if not exists delivery_receiver text,
  add column if not exists delivery_receiver_document text;

alter table public.service_order_photos enable row level security;

drop policy if exists "authenticated_read" on public.service_order_photos;
create policy "authenticated_read" on public.service_order_photos
  for select using (auth.role() = 'authenticated');

drop policy if exists "authenticated_write" on public.service_order_photos;
create policy "authenticated_write" on public.service_order_photos
  for insert with check (auth.role() = 'authenticated');

drop view if exists public.v_service_orders;

create view public.v_service_orders as
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
left join public.customers c on c.id = so.customer_id
left join public.devices d on d.id = so.device_id;
