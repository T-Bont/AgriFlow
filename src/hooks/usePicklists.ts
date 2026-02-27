import { useEffect, useState } from 'react'
import type { Transaction } from '@/types/database'
import { getPicklists, mergeAndSavePicklists } from '@/lib/picklists'

export function usePicklists(transactions?: Transaction[]) {
  const [picklists, setPicklists] = useState<{ vendors: string[]; productNames: string[]; applicationStages: string[] }>({
    vendors: [],
    productNames: [],
    applicationStages: [],
  })

  useEffect(() => {
    let cancelled = false
    getPicklists().then((p) => {
      if (!cancelled) setPicklists(p)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!transactions?.length) return
    const vendors = [...new Set(transactions.map((t) => t.vendor).filter(Boolean))] as string[]
    const productNames = [
      ...new Set(
        transactions
          .map((t) => t.meta_data?.product_name as string | undefined)
          .filter((x): x is string => Boolean(x)),
      ),
    ]
    const applicationStages = [
      ...new Set(
        transactions
          .map((t) => t.meta_data?.application_stage as string | undefined)
          .filter((x): x is string => Boolean(x)),
      ),
    ]
    mergeAndSavePicklists(vendors, productNames, applicationStages).then(() => {
      getPicklists().then(setPicklists)
    })
  }, [transactions])

  return picklists
}
