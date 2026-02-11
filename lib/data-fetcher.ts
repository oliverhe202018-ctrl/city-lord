// lib/data-fetcher.ts
import { cacheManager } from './CacheManager';

/**
 * 通用缓存请求包装器
 * 策略：Cache First (优先读缓存，无缓存则请求 API 并写入缓存)
 */
export async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 300 // 默认缓存 5 分钟
): Promise<T> {
  // 1. 尝试从缓存获取
  const cached = await cacheManager.get<T>(key);
  if (cached) {
    console.log(`[Cache] Hit: ${key}`);
    return cached;
  }

  // 2. 缓存未命中，执行真实请求
  console.log(`[Cache] Miss: ${key}, fetching network...`);
  try {
    const data = await fetcher();
    
    // 3. 写入缓存（异步，不阻塞返回）
    // 注意：这里我们转换一下单位，因为 CacheManager 通常接受毫秒或秒，
    // 假设你的 CacheOptions 接受的是毫秒 maxAge
    cacheManager.set(key, data, { maxAge: ttlSeconds * 1000 });
    
    return data;
  } catch (error) {
    console.error(`[DataFetcher] Error fetching ${key}:`, error);
    throw error;
  }
}