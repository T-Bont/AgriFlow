# AgriFlow

Offline-first farm management PWA: geospatial fields, field-level P&L, and fast data entry.

## Setup

1. Copy `.env.example` to `.env` and set:
   - `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` from your [Supabase](https://supabase.com) project.
   - `VITE_MAPBOX_TOKEN` from [Mapbox](https://mapbox.com) (optional; app works without map).

2. Install and run:

```bash
npm install
npm run dev
```

3. In Supabase: enable Email auth (or your preferred method). The app uses the Supabase JS client; migrations are already applied via the Supabase dashboard/MCP.

## Features

- **Geospatial dashboard**: Mapbox map with fields as polygons (add token to see map; list view works without it).
- **Fields & seasons**: Create fields, add seasons (year + crop), optional sharecropping (operator %).
- **Log transactions**: FAB to add income/expense with conditional fields (fertilizer, grain sale, gov payment, etc.).
- **Offline-first**: Data cached in localStorage; sync queue when back online (LWW).
- **P&L view**: Per-field/per-season net income and breakeven from `view_field_pnl`.
- **Market page**: Local CASH basis table (Buhler) and interactive futures charts for Corn/Soybeans/Wheat.

## Scripts

- `npm run dev` – dev server
- `npm run build` – production build
- `npm run preview` – preview build

## Database

Schema is in Supabase (profiles, fields, seasons, contracts, transactions, `view_field_pnl`). RLS is enabled; PostGIS used for `fields.boundary`. Run migrations from the Supabase project if not already applied.

## Market Data Ingestion

- Edge function: `supabase/functions/market_ingest/index.ts`
- Source location: `https://www.producerag.com/locations/buhler`
- Futures sources: Yahoo chart API for `ZC=F`, `ZS=F`, `KE=F`
- Refresh target: every 10 minutes

### Scheduler setup notes

- Migration `20260408_000003_market_ingest_schedule.sql` attempts to schedule a 10-minute cron if `pg_cron` + `pg_net` exist.
- It reads:
  - `app.settings.supabase_url`
  - `app.settings.service_role_key`
- If those settings/extensions are unavailable, the migration safely no-ops and you can trigger the function from an external cron.

### Manual verification checklist

- Run `market_ingest` and confirm `market_local_bids_raw` receives all scraped rows.
- Confirm `market_local_bids_current` only includes rows where note contains `CASH`.
- Confirm `market_futures_snapshots` populates for all three tickers and expected intervals.
- Open the app `Market` page and verify table data + crop/timeframe chart switching.
- Verify stale indicator appears when `last_updated` is older than ~15 minutes.
