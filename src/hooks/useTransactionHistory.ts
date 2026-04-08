import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useFields } from '@/hooks/useFields'
import { useSyncQueue } from '@/stores/syncQueue'
import type { Season, Transaction } from '@/types/database'

export interface TransactionHistoryItem extends Transaction {
  field_id: string
  field_name: string
  season: Pick<Season, 'id' | 'year' | 'crop_type' | 'field_id'>
}

export function useTransactionHistory() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const enqueue = useSyncQueue((s) => s.enqueue)
  const invalidateTransactionDependents = () => {
    qc.invalidateQueries({ queryKey: ['transactions'] })
    qc.invalidateQueries({ queryKey: ['transactions-by-season'] })
    qc.invalidateQueries({ queryKey: ['view_field_pnl'] })
  }
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

  const validateGrainSale = ({
    seasonId,
    saleQuantity,
    excludeTransactionId,
  }: {
    seasonId: string
    saleQuantity: number
    excludeTransactionId?: string
  }) => {
    const seasonTransactions = (transactionsQuery.data ?? []).filter((t) => t.season_id === seasonId)
    const harvestedBu = seasonTransactions
      .filter((t) => t.category === 'Harvest' && t.unit === 'bu' && t.quantity != null)
      .reduce((sum, t) => sum + (t.quantity ?? 0), 0)
    const soldOtherBu = seasonTransactions
      .filter((t) => t.category === 'Grain Sale' && t.unit === 'bu' && t.quantity != null && t.id !== excludeTransactionId)
      .reduce((sum, t) => sum + (t.quantity ?? 0), 0)
    if (soldOtherBu + saleQuantity > harvestedBu) {
      throw new Error(
        `Cannot save grain sale: ${Math.max(0, harvestedBu - soldOtherBu).toLocaleString()} bu available for this season.`,
      )
    }
  }

  const updateTransaction = useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string
      payload: {
        field_id: string
        season_id: string
        date: string
        amount: number
        quantity: number | null
        unit: Transaction['unit'] | null
        vendor: string | null
        notes: string | null
        meta_data: Record<string, unknown> | null
      }
    }) => {
      const existing = items.find((item) => item.id === id)
      if (!existing) throw new Error('Transaction not found')

      const targetField = (fields ?? []).find((f) => f.id === payload.field_id)
      if (!targetField) throw new Error('Selected field does not exist')

      const targetSeason = seasons.find((s) => s.id === payload.season_id)
      if (!targetSeason || targetSeason.field_id !== payload.field_id) {
        throw new Error('Selected season does not exist for the selected field')
      }

      if (!Number.isFinite(payload.amount)) throw new Error('Amount is invalid')
      if (payload.quantity != null && (!Number.isFinite(payload.quantity) || payload.quantity < 0)) {
        throw new Error('Quantity is invalid')
      }
      if ((existing.category === 'Harvest' || existing.category === 'Grain Sale') && payload.unit !== 'bu') {
        throw new Error(`${existing.category} must use bushels (bu) as unit`)
      }
      if (existing.category === 'Harvest' || existing.category === 'Grain Sale') {
        if (payload.quantity == null || !Number.isFinite(payload.quantity) || payload.quantity <= 0) {
          throw new Error(`${existing.category} quantity must be greater than zero`)
        }
      }

      if (existing.category === 'Grain Sale') {
        const qty = payload.quantity ?? 0
        validateGrainSale({ seasonId: payload.season_id, saleQuantity: qty, excludeTransactionId: id })
      }

      const row = {
        season_id: payload.season_id,
        date: payload.date,
        amount: payload.amount,
        quantity: payload.quantity,
        unit: payload.unit,
        vendor: payload.vendor,
        notes: payload.notes,
        meta_data: payload.meta_data,
        updated_at: new Date().toISOString(),
      }

      if (navigator.onLine) {
        const { data, error } = await supabase.from('transactions').update(row as never).eq('id', id).select().single()
        if (error) throw error
        return data as Transaction
      }

      enqueue({ op: 'update', table: 'transactions', id, payload: row })
      return { ...existing, ...row } as TransactionHistoryItem
    },
    onSuccess: () => {
      invalidateTransactionDependents()
    },
  })

  const deleteTransaction = useMutation({
    mutationFn: async (id: string) => {
      const existing = items.find((item) => item.id === id)
      if (!existing) throw new Error('Transaction not found')

      if (existing.category === 'Grain Sale') {
        validateGrainSale({ seasonId: existing.season_id, saleQuantity: 0, excludeTransactionId: id })
      }

      if (navigator.onLine) {
        const { error } = await supabase.from('transactions').delete().eq('id', id)
        if (error) throw error
        return
      }

      enqueue({ op: 'delete', table: 'transactions', id })
    },
    onSuccess: () => {
      invalidateTransactionDependents()
    },
  })

  return {
    items,
    fields: fields ?? [],
    seasons,
    isLoading: seasonsQuery.isLoading || transactionsQuery.isLoading,
    error: seasonsQuery.error ?? transactionsQuery.error,
    updateTransaction,
    deleteTransaction,
    refetch: () => {
      seasonsQuery.refetch()
      transactionsQuery.refetch()
    },
  }
}

