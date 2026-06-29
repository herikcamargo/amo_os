alter table public.app_settings
  add column if not exists os_entry_terms text not null default 'Cliente autoriza a abertura, analise tecnica e orcamento do aparelho. A AmoCelular nao se responsabiliza por dados sem backup previo.',
  add column if not exists os_exit_terms text not null default 'Cliente declara que conferiu o aparelho, recebeu orientacoes e esta de acordo com os servicos realizados e condicoes de garantia.';
