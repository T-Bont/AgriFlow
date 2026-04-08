-- Schedule market_ingest via pg_cron + pg_net, reading URL and service role from Vault (Option C).
-- Prerequisite: create two Vault secrets (run once in SQL Editor), then this migration schedules the job:
--   select vault.create_secret('https://<ref>.supabase.co', 'market_ingest_supabase_url', 'market_ingest base URL');
--   select vault.create_secret('<service_role_jwt>', 'market_ingest_service_role_key', 'market_ingest auth');
-- If secrets are missing, invoke_market_ingest_cron() raises an exception (visible in cron.job_run_details).

-- Enable "Vault" in Supabase Dashboard → Database → Extensions before applying this migration
-- (Cloud projects ship Vault; do not CREATE EXTENSION vault here — it can fail until enabled in the UI.)

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

create or replace function public.invoke_market_ingest_cron()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  base_url text;
  sr_key text;
  req_id bigint;
begin
  select ds.decrypted_secret
    into base_url
  from vault.decrypted_secrets ds
  where ds.name = 'market_ingest_supabase_url'
  order by ds.created_at desc nulls last
  limit 1;

  select ds.decrypted_secret
    into sr_key
  from vault.decrypted_secrets ds
  where ds.name = 'market_ingest_service_role_key'
  order by ds.created_at desc nulls last
  limit 1;

  if base_url is null or btrim(base_url) = '' then
    raise exception 'Vault secret missing: market_ingest_supabase_url';
  end if;

  if sr_key is null or btrim(sr_key) = '' then
    raise exception 'Vault secret missing: market_ingest_service_role_key';
  end if;

  select net.http_post(
    url := rtrim(base_url, '/') || '/functions/v1/market_ingest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || sr_key
    ),
    body := '{"reason":"scheduled_refresh"}'::jsonb
  )
  into req_id;

  return req_id;
end;
$$;

comment on function public.invoke_market_ingest_cron() is
  'POSTs to market_ingest edge function using Vault secrets market_ingest_supabase_url and market_ingest_service_role_key.';

revoke all on function public.invoke_market_ingest_cron() from public;

do $outer$
declare
  jid bigint;
begin
  for jid in select jobid from cron.job where jobname = 'market_ingest_every_10min'
  loop
    perform cron.unschedule(jid);
  end loop;

  perform cron.schedule(
    'market_ingest_every_10min',
    '*/10 * * * *',
    $cmd$select public.invoke_market_ingest_cron();$cmd$
  );
end $outer$;
