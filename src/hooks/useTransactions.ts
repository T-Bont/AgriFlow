import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useSyncQueue } from '@/stores/syncQueue'
import type { Transaction, TransactionCategory, TransactionType } from '@/types/database'
import { v4 as uuidv4 } from 'uuid'

export function useTransactions(seasonId: string | undefined) {
  const qc = useQueryClient()
  const enqueue = useSyncQueue((s) => s.enqueue)

  const query = useQuery({
    queryKey: ['transactions', seasonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('season_id', seasonId!)
        .order('date', { ascending: false })
      if (error) throw error
      return (data ?? []) as Transaction[]
    },
    enabled: !!seasonId,
  })

  const addTransaction = useMutation({
    mutationFn: async (payload: {
      date: string
      type: TransactionType
      category: TransactionCategory
      amount: number
      vendor?: string
      quantity?: number
      unit?: Transaction['unit']
      notes?: string
      meta_data?: Record<string, unknown>
    }) => {
      if (!seasonId) throw new Error('No season')
      const row = {
        id: uuidv4(),
        season_id: seasonId,
        date: payload.date,
        type: payload.type,
        category: payload.category,
        vendor: payload.vendor ?? null,
        amount: payload.amount,
        quantity: payload.quantity ?? null,
        unit: payload.unit ?? null,
        receipt_url: null,
        notes: payload.notes ?? null,
        meta_data: payload.meta_data ?? null,
        updated_at: new Date().toISOString(),
      }
      if (navigator.onLine) {
        const { data, error } = await supabase.from('transactions').insert(row as never).select().single()
        if (error) throw error
        return data as Transaction
      }
      enqueue({ op: 'insert', table: 'transactions', payload: row, tempId: row.id })
      return row as Transaction
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions', seasonId] })
      qc.invalidateQueries({ queryKey: ['view_field_pnl'] })
    },
  })

  return {
    transactions: query.data ?? [],
    isLoading: query.isLoading,
    addTransaction,
    refetch: query.refetch,
  }
}
