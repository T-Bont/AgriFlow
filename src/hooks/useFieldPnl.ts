import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { FieldPnlRow } from '@/types/database'

export function useFieldPnl() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['view_field_pnl', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('view_field_pnl').select('*')
      if (error) throw error
      return (data ?? []) as FieldPnlRow[]
    },
    enabled: !!user?.id,
  })
}
