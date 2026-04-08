import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { MarketLocalBidCurrent } from '@/types/database'

export function useMarketLocalBids(locationSlug?: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['market-local-bids', locationSlug],
    queryFn: async () => {
      let query = supabase.from('market_local_bids_current').select('*').order('crop', { ascending: true })
      if (locationSlug) {
        query = query.eq('location_slug', locationSlug)
      }
      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as MarketLocalBidCurrent[]
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  })
}
