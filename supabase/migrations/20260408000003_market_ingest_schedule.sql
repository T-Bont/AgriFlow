-- Optional scheduler for market_ingest edge function (every 10 minutes).
-- This is safe to run even if pg_cron/pg_net are unavailable.

do $$
declare
  project_url text := current_setting('app.settings.supabase_url', true);
  service_role text := current_setting('app.settings.service_role_key', true);
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_extension where extname = 'pg_net')
     and project_url is not null
     and project_url <> ''
     and service_role is not null
     and service_role <> '' then
    perform cron.unschedule('market_ingest_every_10min');
    perform cron.schedule(
      'market_ingest_every_10min',
      '*/10 * * * *',
      format(
        $sql$
        select net.http_post(
          url := '%s/functions/v1/market_ingest',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer %s'
          ),
          body := '{"reason":"scheduled_refresh"}'::jsonb
        );
        $sql$,
        project_url,
        service_role
      )
    );
  end if;
end $$;
