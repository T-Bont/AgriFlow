-- Multi static dashboard views: naming + profile pointer settings + legacy backfill.

alter table public.dashboard_snapshots
  add column if not exists name text;

alter table public.dashboard_snapshots
  alter column name set default 'Untitled view';

update public.dashboard_snapshots
set name = coalesce(nullif(name, ''), 'Untitled view')
where name is null or name = '';

alter table public.dashboard_snapshots
  alter column name set not null;

alter table public.dashboard_snapshots
  add column if not exists updated_at timestamptz not null default now();

create index if not exists dashboard_snapshots_updated_at_idx
  on public.dashboard_snapshots (updated_at desc);

-- Backfill: convert legacy profiles.settings.dashboard_snapshot into first-class view pointers.
with legacy_profiles as (
  select
    p.id as user_id,
    p.settings,
    p.settings->'dashboard_snapshot' as legacy_snapshot
  from public.profiles p
  where p.settings ? 'dashboard_snapshot'
    and not (p.settings ? 'dashboard_current_snapshot_id')
),
normalized as (
  select
    lp.user_id,
    lp.settings,
    lp.legacy_snapshot,
    case
      when coalesce(lp.legacy_snapshot->>'snapshot_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then (lp.legacy_snapshot->>'snapshot_id')::uuid
      else null
    end as legacy_snapshot_id
  from legacy_profiles lp
),
resolved as (
  select
    n.user_id,
    n.settings,
    n.legacy_snapshot,
    coalesce(n.legacy_snapshot_id, gen_random_uuid()) as snapshot_id
  from normalized n
),
upserted as (
  insert into public.dashboard_snapshots (
    id,
    user_id,
    bbox,
    image_url,
    width,
    height,
    scale,
    name,
    created_at,
    updated_at
  )
  select
    r.snapshot_id,
    r.user_id,
    coalesce(r.legacy_snapshot->'bbox', jsonb_build_object('west', 0, 'south', 0, 'east', 0, 'north', 0)),
    coalesce(nullif(r.legacy_snapshot->>'image_url', ''), 'legacy-unavailable'),
    coalesce(nullif(r.legacy_snapshot->>'width', '')::int, 800),
    coalesce(nullif(r.legacy_snapshot->>'height', '')::int, 600),
    coalesce(nullif(r.legacy_snapshot->>'scale', '')::int, 2),
    'Default view',
    coalesce(nullif(r.legacy_snapshot->>'created_at', '')::timestamptz, now()),
    now()
  from resolved r
  on conflict (id) do update
    set
      user_id = excluded.user_id,
      bbox = excluded.bbox,
      image_url = excluded.image_url,
      width = excluded.width,
      height = excluded.height,
      scale = excluded.scale,
      updated_at = now(),
      name = case
        when public.dashboard_snapshots.name is null
          or public.dashboard_snapshots.name = ''
          or public.dashboard_snapshots.name = 'Untitled view'
        then 'Default view'
        else public.dashboard_snapshots.name
      end
  returning id, user_id
)
update public.profiles p
set settings = jsonb_set(
  jsonb_set(
    p.settings,
    '{dashboard_current_snapshot_id}',
    to_jsonb(u.id::text),
    true
  ),
  '{dashboard_default_snapshot_id}',
  to_jsonb(u.id::text),
  true
)
from upserted u
where p.id = u.user_id;
