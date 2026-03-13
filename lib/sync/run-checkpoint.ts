import { openDB, IDBPDatabase } from 'idb';
import type { GeoPoint } from '@/hooks/useSafeGeolocation';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { App } from '@capacitor/app';

const DB_NAME = 'run-checkpoint-db';
const STORE_NAME = 'checkpoints';
const CHECKPOINT_KEY = 'latest_run';
const CHECKPOINT_FILE = 'run-checkpoint.json';

interface CheckpointData {
  id: string;
  path: GeoPoint[];
  distance: number;
  duration: number;
  closedPolygons: GeoPoint[][];
  area: number;
  startTime: number;
  updatedAt: number;
}

class RunCheckpoint {
  private dbPromise: Promise<IDBPDatabase<any>> | null = null;
  
  private cache: CheckpointData | null = null;
  private lastFlushPathLength: number = 0;
  private flushTimer: NodeJS.Timeout | null = null;
  private isFlushing = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.dbPromise = openDB(DB_NAME, 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          }
        },
      });
      this.setupAppListeners();
    }
  }

  private setupAppListeners() {
    if (Capacitor.isNativePlatform()) {
      App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) {
          console.log('[RunCheckpoint] App to background, forcing flush');
          this.flush();
        }
      });
    } else {
      if (typeof window !== 'undefined') {
        window.addEventListener('blur', () => this.flush());
        window.addEventListener('beforeunload', () => this.flush());
      }
    }
  }

  // 高频防抖/排队写入，5-10秒 或 积攒 20 个点位 flush 一次
  async saveCheckpoint(data: Omit<CheckpointData, 'id' | 'updatedAt'>) {
    this.cache = {
      ...data,
      id: CHECKPOINT_KEY,
      updatedAt: Date.now(),
    };

    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flush();
      }, 10000); // 10秒必定 flush
    }

    const newPointsCount = data.path.length - this.lastFlushPathLength;
    if (newPointsCount >= 20) {
      this.flush();
    }
  }

  async flush() {
    if (this.isFlushing || !this.cache) return;
    this.isFlushing = true;

    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    const dataToSave = { ...this.cache };
    this.lastFlushPathLength = dataToSave.path.length;
    this.cache = null;

    try {
      if (Capacitor.isNativePlatform()) {
        await Filesystem.writeFile({
          path: CHECKPOINT_FILE,
          data: JSON.stringify(dataToSave),
          directory: Directory.Data,
          encoding: Encoding.UTF8
        });
      } else {
        if (!this.dbPromise) return;
        const db = await this.dbPromise;
        await db.put(STORE_NAME, dataToSave);
      }
    } catch (e) {
      console.warn('[RunCheckpoint] Failed to write checkpoint:', e);
    } finally {
      this.isFlushing = false;
      if (this.cache) {
         this.flushTimer = setTimeout(() => this.flush(), 10000);
      }
    }
  }

  async getCheckpoint(): Promise<CheckpointData | null> {
    try {
      if (this.cache) return this.cache;

      if (Capacitor.isNativePlatform()) {
        try {
          const contents = await Filesystem.readFile({
            path: CHECKPOINT_FILE,
            directory: Directory.Data,
            encoding: Encoding.UTF8
          });
          if (contents.data) {
             return JSON.parse(contents.data as string);
          }
        } catch (e) {
           return null;
        }
      } else {
        if (!this.dbPromise) return null;
        const db = await this.dbPromise;
        return (await db.get(STORE_NAME, CHECKPOINT_KEY)) || null;
      }
    } catch (e) {
      console.warn('[RunCheckpoint] Failed to read checkpoint:', e);
    }
    return null;
  }

  async clearCheckpoint() {
    this.cache = null;
    this.lastFlushPathLength = 0;
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    
    try {
      if (Capacitor.isNativePlatform()) {
        await Filesystem.deleteFile({
          path: CHECKPOINT_FILE,
          directory: Directory.Data
        }).catch(() => {});
      } else {
        if (!this.dbPromise) return;
        const db = await this.dbPromise;
        await db.delete(STORE_NAME, CHECKPOINT_KEY);
      }
    } catch (e) {
      console.warn('[RunCheckpoint] Failed to clear checkpoint:', e);
    }
  }
}

export const runCheckpoint = new RunCheckpoint();
