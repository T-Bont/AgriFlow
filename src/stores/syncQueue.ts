import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type QueueAction = 
  | { op: 'insert'; table: string; payload: Record<string, unknown>; tempId: string }
  | { op: 'update'; table: string; id: string; payload: Record<string, unknown> }
  | { op: 'delete'; table: string; id: string }

interface SyncQueueState {
  queue: QueueAction[]
  enqueue: (action: QueueAction) => void
  dequeue: (index: number) => void
  clear: () => void
  getQueue: () => QueueAction[]
}

export const useSyncQueue = create<SyncQueueState>()(
  persist(
    (set, get) => ({
      queue: [],
      enqueue: (action) => set((s) => ({ queue: [...s.queue, action] })),
      dequeue: (index) => set((s) => ({ queue: s.queue.filter((_, i) => i !== index) })),
      clear: () => set({ queue: [] }),
      getQueue: () => get().queue,
    }),
    { name: 'agriflow-sync-queue' }
  )
)
