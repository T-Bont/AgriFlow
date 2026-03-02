import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useFields } from '@/hooks/useFields'
import type { Season, Transaction } from '@/types/database'

export interface TransactionHistoryItem extends Transaction {
  field_id: string
  field_name: string
  season: Pick<Season, 'id' | 'year' | 'crop_type' | 'field_id'>
}

export function useTransactionHistory() {
  const { user } = useAuth()
  const { fields } = useFields()
  const fieldIds = (fields ?? []).map((f) => f.id)
  const fieldMap = new Map((fields ?? []).map((f) => [f.id, f.name]))

  const seasonsQuery = useQuery({
    queryKey: ['seasons', 'transaction-history', fieldIds.join(',')],
    queryFn: async () => {
      if (fieldIds.length === 0) return []
      const { data, error } = await supabase
        .from('seasons')
        .select('*')
        .in('field_id', fieldIds)
        .order('year', { ascending: false })
      if (error) throw error
      return (data ?? []) as Season[]
    },
    enabled: !!user?.id && fieldIds.length > 0,
  })

  const seasons = seasonsQuery.data ?? []
  const seasonIds = seasons.map((s) => s.id)

  const transactionsQuery = useQuery({
    queryKey: ['transactions', 'history', seasonIds.join(',')],
    queryFn: async () => {
      if (seasonIds.length === 0) return []
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .in('season_id', seasonIds)
        .order('date', { ascending: false })
      if (error) throw error
      return (data ?? []) as Transaction[]
    },
    enabled: seasonIds.length > 0,
  })

  const items: TransactionHistoryItem[] = useMemo(() => {
    const seasonById = new Map(seasons.map((s) => [s.id, s]))
    return (transactionsQuery.data ?? []).map((t) => {
      const season = seasonById.get(t.season_id)
      const fieldId = season?.field_id ?? ''
      return {
        ...t,
        field_id: fieldId,
        field_name: fieldMap.get(fieldId) ?? fieldId,
        season: season
          ? { id: season.id, year: season.year, crop_type: season.crop_type, field_id: season.field_id }
          : { id: t.season_id, year: 0, crop_type: 'Other', field_id: fieldId },
      }
    })
  }, [transactionsQuery.data, seasons, fields])

  return {
    items,
    isLoading: seasonsQuery.isLoading || transactionsQuery.isLoading,
    error: seasonsQuery.error ?? transactionsQuery.error,
    refetch: () => {
      seasonsQuery.refetch()
      transactionsQuery.refetch()
    },
  }
}

