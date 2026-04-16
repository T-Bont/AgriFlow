import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useProfile } from '@/hooks/useProfile'
import type { DashboardSnapshot } from '@/types/database'

export function useDashboardSnapshots() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const { profile, updateProfile } = useProfile()

  const snapshotsQuery = useQuery({
    queryKey: ['dashboard_snapshots', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dashboard_snapshots')
        .select('*')
        .order('updated_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as DashboardSnapshot[]
    },
    enabled: !!user?.id,
  })

  const renameSnapshot = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const nextName = name.trim()
      if (!nextName) throw new Error('View name is required')
      const { error } = await supabase
        .from('dashboard_snapshots')
        .update({ name: nextName, updated_at: new Date().toISOString() } as never)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard_snapshots', user?.id] })
    },
  })

  const deleteSnapshot = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('dashboard_snapshots').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: async (_, deletedId) => {
      const settings = profile?.settings ?? {}
      const nextSettings = { ...settings }
      const currentId = settings.dashboard_current_snapshot_id
      const defaultId = settings.dashboard_default_snapshot_id
      if (currentId === deletedId) delete nextSettings.dashboard_current_snapshot_id
      if (defaultId === deletedId) delete nextSettings.dashboard_default_snapshot_id
      await updateProfile.mutateAsync({ settings: nextSettings })
      qc.invalidateQueries({ queryKey: ['dashboard_snapshots', user?.id] })
    },
  })

  const setCurrentSnapshotId = useMutation({
    mutationFn: async (snapshotId: string | null) => {
      const settings = profile?.settings ?? {}
      const nextSettings = { ...settings }
      if (snapshotId) nextSettings.dashboard_current_snapshot_id = snapshotId
      else delete nextSettings.dashboard_current_snapshot_id
      await updateProfile.mutateAsync({ settings: nextSettings })
    },
  })

  const setDefaultSnapshotId = useMutation({
    mutationFn: async (snapshotId: string | null) => {
      const settings = profile?.settings ?? {}
      const nextSettings = { ...settings }
      if (snapshotId) nextSettings.dashboard_default_snapshot_id = snapshotId
      else delete nextSettings.dashboard_default_snapshot_id
      await updateProfile.mutateAsync({ settings: nextSettings })
    },
  })

  return {
    snapshots: snapshotsQuery.data ?? [],
    isLoading: snapshotsQuery.isLoading,
    error: snapshotsQuery.error,
    refetch: snapshotsQuery.refetch,
    renameSnapshot,
    deleteSnapshot,
    setCurrentSnapshotId,
    setDefaultSnapshotId,
  }
}

