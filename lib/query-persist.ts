import { get, set, del } from 'idb-keyval'
import { PersistedClient, Persister } from '@tanstack/react-query-persist-client'

/**
 * Creates an IndexedDB persister for TanStack Query
 */
export function createIDBPersister(idbValidKey: IDBValidKey = 'reactQuery'): Persister {
  return {
    persistClient: async (client: PersistedClient) => {
      try {
        await set(idbValidKey, client)
      } catch (e) {
        console.error('Failed to persist query client to IDB', e)
      }
    },
    restoreClient: async () => {
      try {
        return await get<PersistedClient>(idbValidKey)
      } catch (e) {
        console.error('Failed to restore query client from IDB', e)
        return undefined
      }
    },
    removeClient: async () => {
      try {
        await del(idbValidKey)
      } catch (e) {
        console.error('Failed to remove query client from IDB', e)
      }
    },
  }
}
