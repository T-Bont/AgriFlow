-- Retention policy for market_local_bids_raw (keep last 10 days).
-- Schedules a daily pg_cron job when the extension is available.

do $$
declare
  jid bigint;
begin
  -- If pg_cron isn't enabled in this project, skip safely.
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    return;
  end if;

  -- Remove any prior job with this name (idempotent migration runs).
  for jid in
    select jobid from cron.job where jobname = 'prune_market_local_bids_raw_daily'
  loop
    perform cron.unschedule(jid);
  end loop;

  -- Run daily at 03:25 UTC.
  perform cron.schedule(
    'prune_market_local_bids_raw_daily',
    '25 3 * * *',
    $cmd$
      delete from public.market_local_bids_raw
      where observed_at < now() - interval '10 days';
    $cmd$
  );
end $$;

