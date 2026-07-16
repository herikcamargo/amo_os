-- Simplificacao de perfis: apenas admin e funcionario.
-- atendente/tecnico viram funcionario (acesso a tudo, exceto
-- financeiro e alteracoes criticas).
--
-- A coluna deixa de usar o enum user_role (que travaria a adicao
-- de valores) e passa a texto com check constraint.

alter table public.users alter column role drop default;
alter table public.users alter column role type text using role::text;

update public.users set role = 'funcionario' where role in ('atendente', 'tecnico');

alter table public.users alter column role set default 'funcionario';
alter table public.users drop constraint if exists users_role_check;
alter table public.users add constraint users_role_check check (role in ('admin', 'funcionario'));

-- Remove o enum antigo se nada mais depender dele
do $$
begin
  drop type if exists user_role;
exception when dependent_objects_still_exist then
  null; -- outra coluna ainda usa; sem problema, fica
end $$;

select 'Migration 012 (roles simplificados) executada com sucesso!' as status;
