import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { OfflineRecord } from './types';

interface SyncSchema extends DBSchema {
  trajectory_buffer: {
    key: number;
    value: OfflineRecord;
    indexes: { 'by-timestamp': number };
  };
}

class SyncManager {
  private dbPromise: Promise<IDBPDatabase<SyncSchema>> | null = null;
  private static instance: SyncManager;
  private isSyncing = false;

  private constructor() {
    if (typeof window !== 'undefined') {
      this.dbPromise = openDB<SyncSchema>('offline-sync-db', 1, {
        upgrade(db) {
          const store = db.createObjectStore('trajectory_buffer', {
            keyPath: 'id',
            autoIncrement: true,
          });
          store.createIndex('by-timestamp', 'timestamp');
        },
      });
    }
  }

  public static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  /**
   * Add a point to the local buffer (Atomic write)
   */
  public async enqueue(record: Omit<OfflineRecord, 'id' | 'retryCount'>) {
    if (!this.dbPromise) return;
    const db = await this.dbPromise;
    await db.add('trajectory_buffer', {
      ...record,
      retryCount: 0
    });
    // console.log('[SyncManager] Point enqueued', record.sequenceId);
  }

  /**
   * Get a batch of pending records
   */
  public async getPendingBatch(limit = 50): Promise<OfflineRecord[]> {
    if (!this.dbPromise) return [];
    const db = await this.dbPromise;
    const tx = db.transaction('trajectory_buffer', 'readonly');
    const store = tx.objectStore('trajectory_buffer');
    
    // Get all keys and limit (idb doesn't support limit on getAll directly in all versions easily without range, 
    // but we can use cursor or just getAllKeys and slice)
    // For simplicity with small buffer:
    let records: OfflineRecord[] = [];
    let cursor = await store.openCursor();
    
    while (cursor && records.length < limit) {
      records.push(cursor.value);
      cursor = await cursor.continue();
    }
    
    return records;
  }

  /**
   * Remove records after successful sync
   */
  public async ack(ids: number[]) {
    if (ids.length === 0 || !this.dbPromise) return;
    const db = await this.dbPromise;
    const tx = db.transaction('trajectory_buffer', 'readwrite');
    const store = tx.objectStore('trajectory_buffer');
    
    await Promise.all(ids.map(id => store.delete(id)));
    await tx.done;
    // console.log('[SyncManager] Batch acked', ids.length);
  }

  /**
   * Get count of pending items
   */
  public async getPendingCount(): Promise<number> {
    if (!this.dbPromise) return 0;
    const db = await this.dbPromise;
    return db.count('trajectory_buffer');
  }

  /**
   * Check if we should throttle based on battery (Placeholder)
   * In a real app, use Capacitor Device API
   */
  public async shouldThrottle(): Promise<boolean> {
    // Implement if needed
    return false;
  }
}

export const syncManager = SyncManager.getInstance();
