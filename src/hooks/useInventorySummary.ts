import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useFields } from '@/hooks/useFields'
import type { Season, Transaction, Contract, CropType } from '@/types/database'

export interface InventoryGroup {
  cropType: CropType
  year: number
  label: string
  totalHarvested: number
  totalSold: number
  totalContracted: number
  unsold: number
  seasonIds: string[]
  fieldNames: string[]
}

export function useInventorySummary() {
  const { user } = useAuth()
  const { fields } = useFields()
  const fieldIds = (fields ?? []).map((f) => f.id)
  const fieldMap = new Map((fields ?? []).map((f) => [f.id, f.name]))

  const seasonsQuery = useQuery({
    queryKey: ['seasons', 'inventory', fieldIds.join(',')],
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

  const seasonIds = (seasonsQuery.data ?? []).map((s) => s.id)

  const transactionsQuery = useQuery({
    queryKey: ['transactions', 'inventory', seasonIds.join(',')],
    queryFn: async () => {
      if (seasonIds.length === 0) return []
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .in('season_id', seasonIds)
      if (error) throw error
      return (data ?? []) as Transaction[]
    },
    enabled: seasonIds.length > 0,
  })

  const contractsQuery = useQuery({
    queryKey: ['contracts', 'inventory', seasonIds.join(',')],
    queryFn: async () => {
      if (seasonIds.length === 0) return []
      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .in('season_id', seasonIds)
      if (error) throw error
      return (data ?? []) as Contract[]
    },
    enabled: seasonIds.length > 0,
  })

  const seasons = seasonsQuery.data ?? []
  const transactions = transactionsQuery.data ?? []
  const contracts = contractsQuery.data ?? []

  const groups: InventoryGroup[] = (() => {
    const byKey = new Map<string, InventoryGroup>()
    for (const s of seasons) {
      const key = `${s.crop_type}-${s.year}`
      if (!byKey.has(key)) {
        byKey.set(key, {
          cropType: s.crop_type,
          year: s.year,
          label: `${s.year} ${s.crop_type}`,
          totalHarvested: 0,
          totalSold: 0,
          totalContracted: 0,
          unsold: 0,
          seasonIds: [],
          fieldNames: [],
        })
      }
      const g = byKey.get(key)!
      g.seasonIds.push(s.id)
      g.fieldNames.push(fieldMap.get(s.field_id) ?? s.field_id)
    }
    for (const t of transactions) {
      const season = seasons.find((s) => s.id === t.season_id)
      if (!season) continue
      const key = `${season.crop_type}-${season.year}`
      const g = byKey.get(key)
      if (!g) continue
      if (t.category === 'Harvest' && t.unit === 'bu' && t.quantity != null) {
        g.totalHarvested += t.quantity
      }
      if (t.category === 'Grain Sale' && t.unit === 'bu' && t.quantity != null) {
        g.totalSold += t.quantity
      }
    }
    for (const c of contracts) {
      const season = seasons.find((s) => s.id === c.season_id)
      if (!season) continue
      const key = `${season.crop_type}-${season.year}`
      const g = byKey.get(key)
      if (!g) continue
      g.totalContracted += c.quantity_bushels
    }
    for (const g of byKey.values()) {
      g.unsold = Math.max(0, g.totalHarvested - g.totalSold - g.totalContracted)
    }
    const order: CropType[] = ['Corn', 'Soy', 'Wheat', 'Other']
    return [...byKey.values()].sort((a, b) => {
      const ai = order.indexOf(a.cropType)
      const bi = order.indexOf(b.cropType)
      if (ai !== bi) return ai - bi
      return b.year - a.year
    })
  })()

  return {
    groups,
    isLoading: seasonsQuery.isLoading || transactionsQuery.isLoading || contractsQuery.isLoading,
    error: seasonsQuery.error ?? transactionsQuery.error ?? contractsQuery.error,
    refetch: () => {
      seasonsQuery.refetch()
      transactionsQuery.refetch()
      contractsQuery.refetch()
    },
  }
}
