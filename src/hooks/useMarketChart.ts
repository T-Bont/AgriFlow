import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { MarketFuturesSnapshot } from '@/types/database'

export type MarketTimeframe = '1D' | '5D' | '1M' | '3M' | '6M' | '1Y'

const timeframeConfig: Record<MarketTimeframe, { interval: string; lookbackMs: number }> = {
  '1D': { interval: '1m', lookbackMs: 24 * 60 * 60 * 1000 },
  '5D': { interval: '5m', lookbackMs: 5 * 24 * 60 * 60 * 1000 },
  '1M': { interval: '1h', lookbackMs: 30 * 24 * 60 * 60 * 1000 },
  '3M': { interval: '1d', lookbackMs: 90 * 24 * 60 * 60 * 1000 },
  '6M': { interval: '1d', lookbackMs: 180 * 24 * 60 * 60 * 1000 },
  '1Y': { interval: '1d', lookbackMs: 365 * 24 * 60 * 60 * 1000 },
}

export function useMarketChart(ticker: string, timeframe: MarketTimeframe) {
  const { user } = useAuth()
  const cfg = timeframeConfig[timeframe]
  const startIso = useMemo(() => new Date(Date.now() - cfg.lookbackMs).toISOString(), [cfg.lookbackMs])

  return useQuery({
    queryKey: ['market-chart', ticker, timeframe],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('market_futures_snapshots')
        .select('*')
        .eq('ticker', ticker)
        .eq('interval', cfg.interval)
        .gte('point_time', startIso)
        .order('point_time', { ascending: true })
      if (error) throw error
      return (data ?? []) as MarketFuturesSnapshot[]
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  })
}
