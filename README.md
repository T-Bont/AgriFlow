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

## Scripts

- `npm run dev` – dev server
- `npm run build` – production build
- `npm run preview` – preview build

## Database

Schema is in Supabase (profiles, fields, seasons, contracts, transactions, `view_field_pnl`). RLS is enabled; PostGIS used for `fields.boundary`. Run migrations from the Supabase project if not already applied.
