-- One-time setup: run in Supabase SQL Editor after migration 20260408223645_market_ingest_vault_cron.sql.
-- 1) Dashboard → Database → Extensions → enable **Vault** (if not already).
-- 2) Replace placeholders below. Do not commit real keys to git.
-- If secrets with these names already exist, update them in Dashboard → Database → Vault.

select vault.create_secret(
  'https://YOUR_PROJECT_REF.supabase.co',
  'market_ingest_supabase_url',
  'Base URL for market_ingest edge function (no trailing slash)'
);

select vault.create_secret(
  'YOUR_SERVICE_ROLE_JWT',
  'market_ingest_service_role_key',
  'Service role JWT for Authorization: Bearer when calling market_ingest'
);

-- Verify (names only; values stay encrypted at rest):
-- select name, description, created_at from vault.secrets where name like 'market_ingest%';
