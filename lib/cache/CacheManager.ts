import { openDB, IDBPDatabase } from 'idb';
import { ICacheManager, CacheItem, CacheOptions } from './types';

const DEFAULT_MAX_AGE = 5 * 60 * 1000; // 5 minutes
const MAX_MEMORY_ITEMS = 1000;
const DB_NAME = 'app-cache-db';
const STORE_NAME = 'key-value-store';
const DB_VERSION = 1;

class CacheManager implements ICacheManager {
  private static instance: CacheManager;
  private memoryCache: Map<string, CacheItem<any>>;
  private isClient: boolean;
  private dbPromise: Promise<IDBPDatabase<any>> | null = null;

  private constructor() {
    this.memoryCache = new Map();
    this.isClient = typeof window !== 'undefined';
    if (this.isClient) {
      this.initDB();
    }
  }

  public static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  private initDB() {
    try {
      this.dbPromise = openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        },
      });
    } catch (error) {
      console.warn('[CacheManager] Failed to initialize IndexedDB:', error);
      this.dbPromise = null;
    }
  }

  /**
   * 获取缓存
   * 优先从内存获取，如果过期或不存在则尝试从 IndexedDB 获取
   */
  public async get<T>(key: string): Promise<T | null> {
    // 1. Check Memory Cache
    if (this.memoryCache.has(key)) {
      const item = this.memoryCache.get(key);
      if (item) {
        if (Date.now() < item.expiresAt) {
          // Hit memory cache
          return item.data as T;
        } else {
          // Expired in memory
          this.memoryCache.delete(key);
          // Fallback to check IndexedDB (maybe it has a fresher or persistent copy?)
        }
      }
    }

    // 2. Check IndexedDB
    if (this.isClient && this.dbPromise) {
      try {
        const db = await this.dbPromise;
        const item = (await db.get(STORE_NAME, key)) as CacheItem<T>;
        
        if (item) {
          if (Date.now() < item.expiresAt) {
            // 3. Hydrate Memory Cache
            this.setMemory(key, item);
            return item.data;
          } else {
            // Expired in DB, clean it up
            await db.delete(STORE_NAME, key);
          }
        }
      } catch (error) {
        console.warn('[CacheManager] IndexedDB lookup error:', error);
      }
    }

    // 4. Not found or expired
    return null;
  }

  /**
   * 设置缓存
   * 同时写入内存和 IndexedDB
   */
  public async set<T>(key: string, data: T, options?: CacheOptions): Promise<void> {
    const maxAge = options?.maxAge ?? DEFAULT_MAX_AGE;
    const now = Date.now();
    const expiresAt = now + maxAge;

    const item: CacheItem<T> = {
      data,
      timestamp: now,
      expiresAt,
    };

    const promises: Promise<any>[] = [];

    // 1. Write to Memory
    this.setMemory(key, item);
    promises.push(Promise.resolve()); // Placeholder to keep structure consistent or just remove if not needed in Promise.all

    // 2. Write to IndexedDB
    if (this.isClient && this.dbPromise && (options?.persist ?? true)) {
      const dbOp = this.dbPromise.then(async (db) => {
        try {
          await db.put(STORE_NAME, item, key);
        } catch (error) {
          console.warn('[CacheManager] IndexedDB set error:', error);
        }
      });
      promises.push(dbOp);
    }

    // Use Promise.all to ensure consistency (wait for DB write)
    await Promise.all(promises);
  }

  public async delete(key: string): Promise<void> {
    this.memoryCache.delete(key);
    
    if (this.isClient && this.dbPromise) {
      try {
        const db = await this.dbPromise;
        await db.delete(STORE_NAME, key);
      } catch (error) {
         console.warn('[CacheManager] IndexedDB delete error:', error);
      }
    }
  }

  public async clear(): Promise<void> {
    this.memoryCache.clear();
    
    if (this.isClient && this.dbPromise) {
      try {
        const db = await this.dbPromise;
        await db.clear(STORE_NAME);
      } catch (error) {
        console.warn('[CacheManager] IndexedDB clear error:', error);
      }
    }
  }

  private setMemory<T>(key: string, item: CacheItem<T>) {
    // Memory Overflow Protection
    if (this.memoryCache.size >= MAX_MEMORY_ITEMS) {
      // Simple strategy: Remove the first inserted item (Map preserves insertion order)
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey) {
        this.memoryCache.delete(firstKey);
      }
    }
    this.memoryCache.set(key, item);
  }
}

export const cacheManager = CacheManager.getInstance();
export default CacheManager;
