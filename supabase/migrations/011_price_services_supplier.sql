-- Fornecedor por opcao de preco + rastreio de alteracao.
-- Aditivo apenas: nada removido ou alterado.

alter table public.price_services
  add column if not exists supplier_id uuid references public.suppliers(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_price_services_supplier on public.price_services (supplier_id)
  where supplier_id is not null;

-- Admin precisa poder excluir opcoes erradas (a policy atual so cobre select/insert/update)
drop policy if exists "auth_delete" on public.price_services;
create policy "auth_delete" on public.price_services for delete using (auth.role() = 'authenticated');

select 'Migration 011 (price_services supplier) executada com sucesso!' as status;
