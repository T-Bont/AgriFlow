-- Market data storage for local cash bids and futures snapshots

create table if not exists public.market_local_bids_raw (
  id bigint generated always as identity primary key,
  location_slug text not null,
  crop text not null,
  basis_month text,
  futures_price numeric(12, 4),
  basis numeric(12, 4),
  cash_price numeric(12, 4),
  note text,
  source_url text not null,
  observed_at timestamptz not null default now(),
  scraped_at timestamptz not null default now(),
  raw_payload jsonb
);

create index if not exists market_local_bids_raw_location_idx
  on public.market_local_bids_raw (location_slug, observed_at desc);
create index if not exists market_local_bids_raw_crop_idx
  on public.market_local_bids_raw (crop, observed_at desc);

create table if not exists public.market_local_bids_current (
  id bigint generated always as identity primary key,
  location_slug text not null,
  crop text not null,
  basis_month text,
  futures_price numeric(12, 4),
  basis numeric(12, 4),
  cash_price numeric(12, 4),
  note text,
  source_url text not null,
  last_updated timestamptz not null default now(),
  unique (location_slug, crop)
);

create index if not exists market_local_bids_current_location_idx
  on public.market_local_bids_current (location_slug, crop);
create index if not exists market_local_bids_current_updated_idx
  on public.market_local_bids_current (last_updated desc);

create table if not exists public.market_futures_snapshots (
  id bigint generated always as identity primary key,
  ticker text not null,
  crop text not null,
  interval text not null,
  point_time timestamptz not null,
  open numeric(12, 4),
  high numeric(12, 4),
  low numeric(12, 4),
  close numeric(12, 4),
  volume bigint,
  fetched_at timestamptz not null default now(),
  source text not null default 'yahoo',
  unique (ticker, interval, point_time)
);

create index if not exists market_futures_snapshots_ticker_time_idx
  on public.market_futures_snapshots (ticker, point_time desc);
create index if not exists market_futures_snapshots_interval_idx
  on public.market_futures_snapshots (interval, point_time desc);

create table if not exists public.market_sync_runs (
  id bigint generated always as identity primary key,
  source text not null,
  status text not null check (status in ('started', 'success', 'error')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error_text text,
  rows_written integer not null default 0,
  meta jsonb
);

create index if not exists market_sync_runs_source_idx
  on public.market_sync_runs (source, started_at desc);

alter table public.market_local_bids_raw enable row level security;
alter table public.market_local_bids_current enable row level security;
alter table public.market_futures_snapshots enable row level security;
alter table public.market_sync_runs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'market_local_bids_raw'
      and policyname = 'market_local_bids_raw_select_auth'
  ) then
    create policy "market_local_bids_raw_select_auth"
      on public.market_local_bids_raw
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'market_local_bids_current'
      and policyname = 'market_local_bids_current_select_auth'
  ) then
    create policy "market_local_bids_current_select_auth"
      on public.market_local_bids_current
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'market_futures_snapshots'
      and policyname = 'market_futures_snapshots_select_auth'
  ) then
    create policy "market_futures_snapshots_select_auth"
      on public.market_futures_snapshots
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'market_sync_runs'
      and policyname = 'market_sync_runs_select_auth'
  ) then
    create policy "market_sync_runs_select_auth"
      on public.market_sync_runs
      for select
      to authenticated
      using (true);
  end if;
end $$;

