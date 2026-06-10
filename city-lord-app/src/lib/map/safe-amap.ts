/**
 * Web-safe AMap loader.
 *
 * 规则：@amap/amap-jsapi-loader 绝对不允许出现在任何文件的顶层 import。
 * 全项目只有本文件内部通过 dynamic import() 引用它。
 */

let cachedAMap: any = null;
let loadingPromise: Promise<any> | null = null;

export interface SafeAMapLoadOptions {
  plugins?: string[];
  version?: string;
  Loca?: {
    version?: string;
  };
}

const DEFAULT_PLUGINS = ['AMap.Scale', 'AMap.MoveAnimation'];
const DEFAULT_VERSION = '2.0';

/**
 * 安全加载高德地图 SDK。
 * - 多次调用只会触发一次真正的网络请求（单例 + Promise 缓存）
 * - 在 SSR / 非浏览器环境下返回 null
 * - 在加载失败时返回 null 并打印错误
 */
export async function safeLoadAMap(
  options?: SafeAMapLoadOptions
): Promise<any | null> {
  // SSR guard
  if (typeof window === 'undefined') return null;

  // 已缓存，直接返回
  if (cachedAMap) return cachedAMap;

  // 正在加载中，复用同一个 Promise
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      // ✅ 不依赖 process.env，直接使用字面量（Next.js 静态导出后 WebView 没有 process 对象）
      const AMAP_KEY = 'e7c09f023c10603e1fa8877e796965e9';
      const AMAP_SECURITY_CODE = 'e827ba611fad4802c48dd900d01eb4bf';

      (window as any)._AMapSecurityConfig = {
        securityJsCode: AMAP_SECURITY_CODE,
      };

      const key = AMAP_KEY;
      if (!key) {
        console.error('[safe-amap] AMAP_KEY 未配置');
        return null;
      }

      // ✅ 唯一允许出现 @amap/amap-jsapi-loader 的地方
      const loaderModule = await import('@amap/amap-jsapi-loader');
      const AMapLoader = loaderModule.default || loaderModule;

      const AMap = await AMapLoader.load({
        key,
        version: options?.version ?? DEFAULT_VERSION,
        plugins: options?.plugins ?? DEFAULT_PLUGINS,
        Loca: options?.Loca,
      });

      cachedAMap = AMap;
      return AMap;
    } catch (err) {
      console.error('[safe-amap] 高德地图加载失败:', err);
      return null;
    } finally {
      loadingPromise = null;
    }
  })();

  return loadingPromise;
}

/**
 * 同步获取已缓存的 AMap 实例（如果尚未加载完成则返回 null）。
 * 适用于已确定地图加载完成后的场景，如事件回调、工具函数等。
 */
export function getAMapSync(): any | null {
  return cachedAMap;
}

/**
 * 安全创建地图实例。
 * 封装了完整的 load → new AMap.Map 流程。
 */
export async function safeCreateMap(
  container: HTMLElement,
  mapOptions?: Record<string, any>,
  loadOptions?: SafeAMapLoadOptions
): Promise<any | null> {
  const AMap = await safeLoadAMap(loadOptions);
  if (!AMap) return null;

  try {
    const map = new AMap.Map(container, {
      zoom: 13,
      center: [116.397428, 39.90923],
      viewMode: '2D',
      pitch: 0,
      mapStyle: 'amap://styles/22e069175d1afe32e9542abefde02cb5',
      showLabel: true,
      
      // ✅ Layer 3 优化：限制瓦片缓存数量，防止 tile memory limits exceeded
      tileSizeCache: 64, // 默认值通常是 256-512，低内存设备建议 64-128
      
      // ✅ 降低地图分辨率倍率，减少 GPU 纹理占用
      // 1 = 标准分辨率; 0.75 = 降低 44% 显存占用，视觉差异几乎不可感知
      devicePixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
      
      // ✅ 关闭不必要的3D楼块渲染（3D瓦片比2D消耗多3倍显存）
      showBuildingBlock: false,
      
      // ✅ 调整最大缩放级别，防止过度细化导致瓦片爆炸
      zooms: [3, 18],  // 默认是 [3, 20]，限制到 18 减少高缩放层级瓦片
      
      ...mapOptions,
    });
    return map;
  } catch (err) {
    console.error('[safe-amap] 创建地图实例失败:', err);
    return null;
  }
}

/**
 * 安全销毁地图实例。
 */
export function safeDestroyMap(map: any | null) {
  try {
    if (map && typeof map.destroy === 'function') {
      map.destroy();
    }
  } catch (err) {
    console.warn('[safe-amap] 销毁地图实例时出错:', err);
  }
}

/**
 * 安全添加地图控件。
 * 示例：safeAddControl(map, 'Scale')
 */
export async function safeAddControl(map: any, controlName: string, options?: Record<string, any>) {
  const AMap = await safeLoadAMap();
  if (!AMap || !map) return null;

  try {
    const ControlClass = AMap[controlName];
    if (!ControlClass) {
      console.warn(`[safe-amap] 控件 AMap.${controlName} 不存在，可能需要在 plugins 中声明`);
      return null;
    }
    const control = new ControlClass(options);
    map.addControl(control);
    return control;
  } catch (err) {
    console.warn(`[safe-amap] 添加控件 ${controlName} 失败:`, err);
    return null;
  }
}
