import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useSyncQueue } from '@/stores/syncQueue'
import type { Season } from '@/types/database'
import { v4 as uuidv4 } from 'uuid'

export function useSeasons(fieldId: string | undefined) {
  const qc = useQueryClient()
  const enqueue = useSyncQueue((s) => s.enqueue)

  const query = useQuery({
    queryKey: ['seasons', fieldId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seasons')
        .select('*')
        .eq('field_id', fieldId!)
        .order('year', { ascending: false })
      if (error) throw error
      return (data ?? []) as Season[]
    },
    enabled: !!fieldId,
  })

  const createSeason = useMutation({
    mutationFn: async (payload: { year: number; crop_type: Season['crop_type']; landlord_share_percent?: number; landlord_name?: string; estimated_yield_per_acre?: number }) => {
      if (!fieldId) throw new Error('No field')
      const row = {
        id: uuidv4(),
        field_id: fieldId,
        year: payload.year,
        crop_type: payload.crop_type,
        status: 'Active' as const,
        landlord_share_percent: payload.landlord_share_percent ?? 0,
        landlord_name: payload.landlord_name ?? null,
        estimated_yield_per_acre: payload.estimated_yield_per_acre ?? null,
        actual_harvest_bushels: null,
        updated_at: new Date().toISOString(),
      }
      if (navigator.onLine) {
        const { data, error } = await supabase.from('seasons').insert(row as never).select().single()
        if (error) throw error
        return data as Season
      }
      enqueue({ op: 'insert', table: 'seasons', payload: row, tempId: row.id })
      return row as Season
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['seasons', fieldId] })
      qc.invalidateQueries({ queryKey: ['view_field_pnl'] })
    },
  })

  const updateSeason = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<Season> }) => {
      const row = { ...payload, updated_at: new Date().toISOString() }
      if (navigator.onLine) {
        const { data, error } = await supabase.from('seasons').update(row as never).eq('id', id).select().single()
        if (error) throw error
        return data as Season
      }
      enqueue({ op: 'update', table: 'seasons', id, payload: row })
      return row
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['seasons', fieldId] })
      qc.invalidateQueries({ queryKey: ['view_field_pnl'] })
    },
  })

  return {
    seasons: query.data ?? [],
    isLoading: query.isLoading,
    createSeason,
    updateSeason,
    refetch: query.refetch,
  }
}
