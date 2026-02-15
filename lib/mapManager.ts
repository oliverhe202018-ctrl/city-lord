import { safeLoadAMap, safeDestroyMap } from '@/lib/map/safe-amap';

// 定义 AMap 类型 (简化的)
// 由于 @amap/amap-jsapi-loader 加载的类型比较复杂，这里使用 any 并添加注释
type AMapInstance = any;
type AMapSDK = any;

interface MapConfig {
  key: string;
  securityCode?: string;
  version?: string;
  plugins?: string[];
  container: HTMLElement;
  center?: [number, number];
  zoom?: number;
  mapStyle?: string;
  skyColor?: string;
}

class MapManager {
  private static instance: MapManager;
  private map: AMapInstance | null = null;
  private amap: AMapSDK | null = null;
  private isLoading: boolean = false;
  private loadingPromise: Promise<AMapSDK> | null = null;

  private constructor() {}

  public static getInstance(): MapManager {
    if (!MapManager.instance) {
      MapManager.instance = new MapManager();
    }
    return MapManager.instance;
  }

  /**
   * 初始化或获取地图实例
   */
  public async initMap(config: MapConfig): Promise<{ map: AMapInstance; AMap: AMapSDK }> {
    if (this.map && this.amap) {
      // 如果容器变了，需要重新挂载吗？通常 AMap 实例绑定在特定 DOM 上。
      // 如果传入了新的 container 且与旧的不同，我们需要销毁旧的并创建新的，或者尝试 setTarget (如果支持)。
      // AMap 2.0 通常建议销毁重建，或者仅仅保留实例但要注意 DOM 引用。
      // 简单起见，如果已存在实例，先检查容器是否一致。
      
      // 这里为了确保单例在 React 组件卸载/重挂载时能复用或者正确重建：
      // 策略：如果调用 initMap，我们假设是希望确保地图存在。
      // 如果当前有 map 且容器还在文档中，可能不需要做啥。
      // 但 React 重挂载时，container 元素是新的。
      // 所以必须在新 container 上重新创建 map，或者把旧 map destroy 掉。
      
      // 我们的单例主要是为了管理 AMapLoader 的加载状态和可能的全局配置，
      // 对于 Map 实例本身，如果 DOM 变了，Map 实例通常也得变。
      // 但为了防止内存泄漏，我们需要先 destroy 旧的。
      this.destroyMap();
    }

    try {
      this.isLoading = true;

      // 使用 safeLoadAMap 替代直接调用 AMapLoader
      this.amap = await safeLoadAMap({
        version: config.version || "2.0",
        plugins: config.plugins || [],
      });

      if (!this.amap) {
        throw new Error("Failed to load AMap SDK");
      }

      if (!config.container) {
        throw new Error("Map container is required");
      }

      this.map = new this.amap.Map(config.container, {
        viewMode: "2D",
        zoom: config.zoom || 17,
        center: config.center || [116.397428, 39.90923],
        mapStyle: config.mapStyle || "amap://styles/dark",
        skyColor: config.skyColor || "#1f2029",
      });

      return { map: this.map, AMap: this.amap };
    } catch (error) {
      console.error("MapManager: Failed to load map", error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  public getMap(): AMapInstance | null {
    return this.map;
  }

  public getAMap(): AMapSDK | null {
    return this.amap;
  }

  /**
   * 销毁地图实例
   */
  public destroyMap() {
    if (this.map) {
      safeDestroyMap(this.map);
      this.map = null;
    }
    // 注意：AMap SDK (this.amap) 不需要销毁，它加载在 window 上
  }
}

export default MapManager;
