import { QueryClient } from '@tanstack/react-query'
import type { PersistedClient } from '@tanstack/query-persist-client-core'
import { get, set, del } from 'idb-keyval'

const CACHE_KEY = 'agriflow-query-cache'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: !!navigator.onLine,
    },
  },
})

const persister = typeof window !== 'undefined'
  ? {
      persistClient: async (persistedClient: PersistedClient) => {
        await set(CACHE_KEY, JSON.stringify(persistedClient))
      },
      restoreClient: async (): Promise<PersistedClient | undefined> => {
        const raw = await get<string>(CACHE_KEY)
        if (!raw) return undefined
        try {
          return JSON.parse(raw) as PersistedClient
        } catch {
          return undefined
        }
      },
      removeClient: async () => {
        await del(CACHE_KEY)
      },
    }
  : {
      persistClient: async () => {},
      restoreClient: async () => undefined as PersistedClient | undefined,
      removeClient: async () => {},
    }

export { persister }
export const persistOptions = {
  persister,
  maxAge: 7 * 24 * 60 * 60 * 1000,
}
