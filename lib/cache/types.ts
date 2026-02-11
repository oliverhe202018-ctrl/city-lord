export interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export interface CacheOptions {
  /**
   * 缓存有效期（毫秒）
   * @default 300000 (5分钟)
   */
  maxAge?: number;
  /**
   * 是否持久化到 IndexedDB
   * @default true
   */
  persist?: boolean;
}

export interface ICacheManager {
  /**
   * 获取缓存数据
   * @param key 缓存键
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * 设置缓存数据
   * @param key 缓存键
   * @param data 数据
   * @param options 配置项
   */
  set<T>(key: string, data: T, options?: CacheOptions): Promise<void>;

  /**
   * 删除缓存
   * @param key 缓存键
   */
  delete(key: string): Promise<void>;

  /**
   * 清空所有缓存
   */
  clear(): Promise<void>;
}
