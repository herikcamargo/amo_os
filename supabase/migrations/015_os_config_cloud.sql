alter table public.app_settings
  add column if not exists os_config jsonb;
