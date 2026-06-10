import { openDB, IDBPDatabase, DBSchema } from 'idb';

interface SettlementPayload {
  idempotencyKey?: string;
  userId: string;
  [key: string]: unknown;
}

interface SettlementRecordBase {
  id?: number;
  payload: SettlementPayload;
  retryCount: number;
  created_at: number;
  lastAttemptAt: number;
}

export type SettlementRecord =
  | (SettlementRecordBase & { status: 'pending' | 'uploading'; lastError?: never })
  | (SettlementRecordBase & { status: 'failed'; lastError: string });

interface SettlementDBSchema extends DBSchema {
  pending_settlements: {
    key: number;
    value: SettlementRecord;
    indexes: { 'by-created': number; 'by-status': string };
  };
}

const MAX_QUEUE_SIZE = 50;
const FLUSH_BACKOFF_MS = 60_000;

class SettlementRetryQueue {
  private dbPromise: Promise<IDBPDatabase<SettlementDBSchema>> | null = null;
  private static instance: SettlementRetryQueue;
  private flushInProgress = false;
  private lastFailureAt = 0;

  private constructor() {
    if (typeof window !== 'undefined') {
      this.dbPromise = openDB<SettlementDBSchema>('offline-sync-db', 2, {
        upgrade(db, oldVersion) {
          if (oldVersion < 2) {
            const store = db.createObjectStore('pending_settlements', {
              keyPath: 'id',
              autoIncrement: true,
            });
            store.createIndex('by-created', 'created_at');
            store.createIndex('by-status', 'status');
          }
        },
      });
    }
  }

  public static getInstance(): SettlementRetryQueue {
    if (!SettlementRetryQueue.instance) {
      SettlementRetryQueue.instance = new SettlementRetryQueue();
    }
    return SettlementRetryQueue.instance;
  }

  public async enqueueSettlement(payload: SettlementPayload): Promise<boolean> {
    if (!this.dbPromise) return false;
    try {
      const db = await this.dbPromise;

      // 前置唯一性校验：使用当前结算请求的 payload.idempotencyKey 检索队列
      if (payload.idempotencyKey) {
        const tx = db.transaction('pending_settlements', 'readonly');
        const store = tx.objectStore('pending_settlements');
        let cursor = await store.openCursor();
        let exists = false;
        while (cursor) {
          if (cursor.value.payload.idempotencyKey === payload.idempotencyKey) {
            exists = true;
            break;
          }
          cursor = await cursor.continue();
        }
        await tx.done;
        if (exists) {
          console.warn(`[SettlementRetryQueue] Duplicate settlement detected with idempotencyKey: ${payload.idempotencyKey}`);
          return false;
        }
      }

      const count = await db.count('pending_settlements');
      if (count >= MAX_QUEUE_SIZE) {
        console.warn(`[SettlementRetryQueue] Queue full (${count}/${MAX_QUEUE_SIZE}), evicting oldest entries`);
        const tx = db.transaction('pending_settlements', 'readwrite');
        const store = tx.objectStore('pending_settlements');
        const index = store.index('by-created');
        let cursor = await index.openCursor();
        const evictCount = Math.min(10, count - MAX_QUEUE_SIZE + 1);
        for (let i = 0; i < evictCount && cursor; i++) {
          await cursor.delete();
          cursor = await cursor.continue();
        }
        await tx.done;
      }
      await db.add('pending_settlements', {
        payload,
        retryCount: 0,
        created_at: Date.now(),
        lastAttemptAt: 0,
        status: 'pending',
      });
      console.log('[SettlementRetryQueue] Settlement enqueued, idempotencyKey:', payload.idempotencyKey);
      return true;
    } catch (err) {
      console.error('[SettlementRetryQueue] Failed to enqueue settlement', err);
      return false;
    }
  }

  public async getPendingSettlements(limit = 10): Promise<SettlementRecord[]> {
    if (!this.dbPromise) return [];
    try {
      const db = await this.dbPromise;
      const tx = db.transaction('pending_settlements', 'readonly');
      const store = tx.objectStore('pending_settlements');
      const index = store.index('by-created');
      
      const records: SettlementRecord[] = [];
      let cursor = await index.openCursor();
      
      while (cursor && records.length < limit) {
        if (cursor.value.status === 'pending') {
          records.push(cursor.value);
        }
        cursor = await cursor.continue();
      }
      
      return records;
    } catch (err) {
      console.error('[SettlementRetryQueue] Failed to get pending settlements', err);
      return [];
    }
  }

  public async ackSettlement(id: number): Promise<void> {
    if (!this.dbPromise) return;
    try {
      const db = await this.dbPromise;
      await db.delete('pending_settlements', id);
      console.log('[SettlementRetryQueue] Settlement acked, id:', id);
    } catch (err) {
      console.error('[SettlementRetryQueue] Failed to ack settlement', err);
    }
  }

  public async markFailed(id: number, errorMessage?: string): Promise<void> {
    if (!this.dbPromise) return;
    try {
      const db = await this.dbPromise;
      const tx = db.transaction('pending_settlements', 'readwrite');
      const store = tx.objectStore('pending_settlements');
      const record = await store.get(id);
      if (record) {
        record.retryCount++;
        record.lastAttemptAt = Date.now();
        if (record.retryCount > 5) {
          record.status = 'failed';
          record.lastError = errorMessage ?? record.lastError ?? 'Unknown error';
        } else {
          record.status = 'pending';
          record.lastError = errorMessage ?? record.lastError;
        }
        await store.put(record);
      }
      await tx.done;
    } catch (err) {
      console.error('[SettlementRetryQueue] Failed to mark settlement as failed', err);
    }
  }

  public async flushPendingSettlements(): Promise<void> {
    if (this.flushInProgress || !this.dbPromise) return;

    const now = Date.now();
    if (now - this.lastFailureAt < FLUSH_BACKOFF_MS) {
      console.log(`[SettlementRetryQueue] Backoff active, skipping flush (${Math.round((FLUSH_BACKOFF_MS - (now - this.lastFailureAt)) / 1000)}s remaining)`);
      return;
    }

    this.flushInProgress = true;

    try {
      const settlements = await this.getPendingSettlements(10);
      if (settlements.length === 0) return;

      console.log(`[SettlementRetryQueue] Flushing ${settlements.length} pending settlements`);

      const { saveRunActivity } = await import('@/app/actions/run-service');

      for (const settlement of settlements) {
        try {
          const { userId, ...runPayload } = settlement.payload;
          const result = await saveRunActivity(userId, runPayload as any);

          if (result.success) {
            await this.ackSettlement(settlement.id!);
            console.log('[SettlementRetryQueue] Settlement uploaded successfully, id:', settlement.id);
          } else {
            this.lastFailureAt = Date.now();
            await this.markFailed(settlement.id!, result.error ?? 'Unknown error');
            console.warn('[SettlementRetryQueue] Settlement upload failed, id:', settlement.id, result.error);
          }
        } catch (err) {
          this.lastFailureAt = Date.now();
          const errorMsg = err instanceof Error ? err.message : String(err);
          await this.markFailed(settlement.id!, errorMsg);
          console.error('[SettlementRetryQueue] Settlement upload error, id:', settlement.id, err);
        }
      }
    } finally {
      this.flushInProgress = false;
    }
  }

  public async getPendingCount(): Promise<number> {
    if (!this.dbPromise) return 0;
    try {
      const db = await this.dbPromise;
      return db.countFromIndex('pending_settlements', 'by-status', IDBKeyRange.only('pending'));
    } catch {
      return 0;
    }
  }
}

export const settlementRetryQueue = SettlementRetryQueue.getInstance();
