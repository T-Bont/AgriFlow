import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { MarketLocalBidCurrent } from '@/types/database'

export function useMarketLocalBids(locationSlug = 'buhler') {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['market-local-bids', locationSlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('market_local_bids_current')
        .select('*')
        .eq('location_slug', locationSlug)
        .order('crop', { ascending: true })
      if (error) throw error
      return (data ?? []) as MarketLocalBidCurrent[]
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  })
}
