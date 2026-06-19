// [P6] 离线队列 JSON 免疫 — 防御 localStorage 数据损坏导致应用崩溃

/**
 * 安全解析离线队列 JSON 字符串
 * - 捕获 JSON 解析异常
 * - 校验顶层结构必须为数组
 * - 过滤掉无效条目（非对象或 null）
 * - 损坏时备份原始数据并返回空数组，避免应用崩溃
 */
export function safeParseQueue<T = Record<string, unknown>>(raw: string, queueKey: string = 'offline_queue'): T[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.warn(`[${queueKey}] Corrupted queue: not an array, discarding`);
      return [];
    }
    return parsed.filter((item: unknown) => item && typeof item === 'object') as T[];
  } catch (e) {
    console.error(`[${queueKey}] JSON parse failed, discarding corrupted queue`);
    // 备份损坏的队列数据，便于后续诊断
    try {
      localStorage.setItem(`${queueKey}_backup_${Date.now()}`, raw);
    } catch {
      // 忽略备份失败（如 quota 超限）
    }
    return [];
  }
}
