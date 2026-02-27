import { supabase } from './supabase'
import { useSyncQueue } from '@/stores/syncQueue'
import { queryClient } from './queryClient'


export async function processSyncQueue(): Promise<{ ok: number; failed: number }> {
  const queue = [...useSyncQueue.getState().getQueue()]
  let ok = 0
  let failed = 0
  const toRemove: number[] = []
  for (let i = 0; i < queue.length; i++) {
    const action = queue[i]
    try {
      if (action.op === 'insert') {
        const { data, error } = await supabase
          .from(action.table as 'fields' | 'seasons' | 'contracts' | 'transactions' | 'profiles')
          .insert(action.payload as never)
          .select('id')
          .single()
        if (error) throw error
        ok++
        toRemove.push(i)
        if (action.table === 'transactions' && (data as { id?: string } | null)?.id) {
          queryClient.invalidateQueries({ queryKey: ['transactions'] })
        }
      } else if (action.op === 'update') {
        const { error } = await supabase
          .from(action.table as 'fields' | 'seasons' | 'contracts' | 'transactions' | 'profiles')
          .update(action.payload as never)
          .eq('id', action.id)
        if (error) throw error
        ok++
        toRemove.push(i)
      } else if (action.op === 'delete') {
        const { error } = await supabase
          .from(action.table as 'fields' | 'seasons' | 'contracts' | 'transactions' | 'profiles')
          .delete()
          .eq('id', action.id)
        if (error) throw error
        ok++
        toRemove.push(i)
      }
    } catch {
      failed++
    }
  }
  toRemove.sort((a, b) => b - a).forEach((i) => useSyncQueue.getState().dequeue(i))
  queryClient.invalidateQueries()
  return { ok, failed }
}

export async function pullLatest() {
  await queryClient.invalidateQueries()
  await queryClient.refetchQueries()
}
