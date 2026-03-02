import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { DashboardSnapshotFieldBoundary } from '@/types/database'

export function useDashboardSnapshotBoundaries(snapshotId: string | null | undefined) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['dashboard_snapshot_field_boundaries', user?.id, snapshotId],
    queryFn: async () => {
      if (!snapshotId) return [] as DashboardSnapshotFieldBoundary[]
      const { data, error } = await supabase
        .from('dashboard_snapshot_field_boundaries')
        .select('*')
        .eq('snapshot_id', snapshotId)
      if (error) throw error
      return (data ?? []) as DashboardSnapshotFieldBoundary[]
    },
    enabled: !!user?.id && !!snapshotId,
  })
}

