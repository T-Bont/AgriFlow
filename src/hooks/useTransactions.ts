import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useSyncQueue } from '@/stores/syncQueue'
import type { Transaction, TransactionCategory, TransactionType } from '@/types/database'
import { v4 as uuidv4 } from 'uuid'

export function useTransactions(seasonId: string | undefined) {
  const qc = useQueryClient()
  const enqueue = useSyncQueue((s) => s.enqueue)
  const invalidateTransactionDependents = () => {
    qc.invalidateQueries({ queryKey: ['transactions'] })
    qc.invalidateQueries({ queryKey: ['transactions-by-season'] })
    qc.invalidateQueries({ queryKey: ['view_field_pnl'] })
  }

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
      if (!Number.isFinite(payload.amount)) throw new Error('Amount is invalid')
      if (payload.quantity != null && (!Number.isFinite(payload.quantity) || payload.quantity < 0)) {
        throw new Error('Quantity is invalid')
      }
      if ((payload.category === 'Harvest' || payload.category === 'Grain Sale') && payload.unit !== 'bu') {
        throw new Error(`${payload.category} must use bushels (bu) as unit`)
      }
      if (payload.category === 'Harvest' || payload.category === 'Grain Sale') {
        if (payload.quantity == null || !Number.isFinite(payload.quantity) || payload.quantity <= 0) {
          throw new Error(`${payload.category} quantity must be greater than zero`)
        }
      }

      if (payload.category === 'Grain Sale') {
        const seasonTransactions = query.data ?? []
        const harvestedBu = seasonTransactions
          .filter((t) => t.category === 'Harvest' && t.unit === 'bu' && t.quantity != null)
          .reduce((sum, t) => sum + (t.quantity ?? 0), 0)
        const soldBu = seasonTransactions
          .filter((t) => t.category === 'Grain Sale' && t.unit === 'bu' && t.quantity != null)
          .reduce((sum, t) => sum + (t.quantity ?? 0), 0)
        const nextQty = payload.quantity ?? 0
        if (soldBu + nextQty > harvestedBu) {
          throw new Error(
            `Cannot save grain sale: ${Math.max(0, harvestedBu - soldBu).toLocaleString()} bu available for this season.`,
          )
        }
      }

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
      invalidateTransactionDependents()
    },
  })

  return {
    transactions: query.data ?? [],
    isLoading: query.isLoading,
    addTransaction,
    refetch: query.refetch,
  }
}
