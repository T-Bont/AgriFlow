-- Static dashboard snapshot boundary editing

-- 1) Snapshot metadata table (optional but recommended)
create table if not exists public.dashboard_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  bbox jsonb not null,
  image_url text not null,
  width integer not null,
  height integer not null,
  scale integer,
  created_at timestamptz not null default now()
);

create index if not exists dashboard_snapshots_user_id_idx on public.dashboard_snapshots (user_id);
create index if not exists dashboard_snapshots_created_at_idx on public.dashboard_snapshots (created_at desc);

alter table public.dashboard_snapshots enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'dashboard_snapshots'
      and policyname = 'dashboard_snapshots_select_own'
  ) then
    create policy "dashboard_snapshots_select_own"
      on public.dashboard_snapshots
      for select
      to authenticated
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'dashboard_snapshots'
      and policyname = 'dashboard_snapshots_insert_own'
  ) then
    create policy "dashboard_snapshots_insert_own"
      on public.dashboard_snapshots
      for insert
      to authenticated
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'dashboard_snapshots'
      and policyname = 'dashboard_snapshots_update_own'
  ) then
    create policy "dashboard_snapshots_update_own"
      on public.dashboard_snapshots
      for update
      to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end $$;

-- 2) Per-field static boundary points (normalized 0..1 coordinates)
create table if not exists public.dashboard_snapshot_field_boundaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  snapshot_id uuid not null references public.dashboard_snapshots (id) on delete cascade,
  field_id uuid not null references public.fields (id) on delete cascade,
  -- ring as [[nx, ny], ...] where each is 0..1 (not necessarily closed; UI can close visually)
  ring_norm jsonb not null,
  updated_at timestamptz not null default now(),
  unique (snapshot_id, field_id)
);

create index if not exists dashboard_snapshot_field_boundaries_user_id_idx on public.dashboard_snapshot_field_boundaries (user_id);
create index if not exists dashboard_snapshot_field_boundaries_snapshot_id_idx on public.dashboard_snapshot_field_boundaries (snapshot_id);
create index if not exists dashboard_snapshot_field_boundaries_field_id_idx on public.dashboard_snapshot_field_boundaries (field_id);

alter table public.dashboard_snapshot_field_boundaries enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'dashboard_snapshot_field_boundaries'
      and policyname = 'dashboard_snapshot_field_boundaries_select_own'
  ) then
    create policy "dashboard_snapshot_field_boundaries_select_own"
      on public.dashboard_snapshot_field_boundaries
      for select
      to authenticated
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'dashboard_snapshot_field_boundaries'
      and policyname = 'dashboard_snapshot_field_boundaries_insert_own'
  ) then
    create policy "dashboard_snapshot_field_boundaries_insert_own"
      on public.dashboard_snapshot_field_boundaries
      for insert
      to authenticated
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'dashboard_snapshot_field_boundaries'
      and policyname = 'dashboard_snapshot_field_boundaries_update_own'
  ) then
    create policy "dashboard_snapshot_field_boundaries_update_own"
      on public.dashboard_snapshot_field_boundaries
      for update
      to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end $$;

