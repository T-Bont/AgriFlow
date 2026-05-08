-- Allow users to delete their own dashboard snapshot views (and boundaries).

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'dashboard_snapshots'
      and policyname = 'dashboard_snapshots_delete_own'
  ) then
    create policy "dashboard_snapshots_delete_own"
      on public.dashboard_snapshots
      for delete
      to authenticated
      using (user_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'dashboard_snapshot_field_boundaries'
      and policyname = 'dashboard_snapshot_field_boundaries_delete_own'
  ) then
    create policy "dashboard_snapshot_field_boundaries_delete_own"
      on public.dashboard_snapshot_field_boundaries
      for delete
      to authenticated
      using (user_id = auth.uid());
  end if;
end $$;

