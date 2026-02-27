import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useSyncQueue } from '@/stores/syncQueue'
import type { Field } from '@/types/database'
import { v4 as uuidv4 } from 'uuid'

export function useFields() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const enqueue = useSyncQueue((s) => s.enqueue)

  const query = useQuery({
    queryKey: ['fields', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fields')
        .select('*')
        .order('name')
      if (error) throw error
      return (data ?? []) as Field[]
    },
    enabled: !!user?.id,
  })

  const createField = useMutation({
    mutationFn: async (payload: { name: string; acres?: number; boundary?: unknown; gis_acres?: number }) => {
      if (!user?.id) throw new Error('Not authenticated')
      const row = {
        id: uuidv4(),
        user_id: user.id,
        name: payload.name,
        acres: payload.acres ?? payload.gis_acres ?? null,
        gis_acres: payload.gis_acres ?? null,
        boundary: payload.boundary ?? null,
        updated_at: new Date().toISOString(),
      }
      if (navigator.onLine) {
        const { data, error } = await supabase.from('fields').insert(row as never).select().single()
        if (error) throw error
        return data as Field
      }
      enqueue({ op: 'insert', table: 'fields', payload: row, tempId: row.id })
      return row as Field
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fields'] }),
  })

  const updateField = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<Field> }) => {
      const row = { ...payload, updated_at: new Date().toISOString() }
      if (navigator.onLine) {
        const { data, error } = await supabase.from('fields').update(row as never).eq('id', id).select().single()
        if (error) throw error
        return data as Field
      }
      enqueue({ op: 'update', table: 'fields', id, payload: row })
      return { ...query.data?.find((f) => f.id === id), ...row } as Field
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fields'] }),
  })

  const deleteField = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) throw new Error('Not authenticated')
      if (navigator.onLine) {
        const { error } = await supabase.from('fields').delete().eq('id', id)
        if (error) throw error
        return
      }
      enqueue({ op: 'delete', table: 'fields', id })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fields'] }),
  })

  return { fields: query.data ?? [], isLoading: query.isLoading, error: query.error, createField, updateField, deleteField, refetch: query.refetch }
}
