// H3WorkerManager.ts
// Singleton class to manage the H3 worker instance
import { H3WorkerRequest, H3WorkerResponse } from "./workers/h3.worker";

export class H3WorkerManager {
  private static instance: H3WorkerManager;
  private worker: Worker | null = null;
  private currentRequestId: string | null = null;
  private pendingResolve: ((value: string[]) => void) | null = null;
  private workerPromise: Promise<Worker> | null = null;

  private constructor() {
    // Lazy initialization
  }

  public static getInstance(): H3WorkerManager {
    if (!H3WorkerManager.instance) {
      H3WorkerManager.instance = new H3WorkerManager();
    }
    return H3WorkerManager.instance;
  }

  private createWorker(): Worker {
    const worker = new Worker(new URL("./workers/h3.worker.ts", import.meta.url));
    worker.onmessage = (event: MessageEvent<H3WorkerResponse>) => {
      const { id, success, data, error } = event.data;

      // Only handle if ID matches current request
      if (id === this.currentRequestId && this.pendingResolve) {
        if (success && data) {
          this.pendingResolve(data);
        } else {
          console.error("[H3Worker] Calculation Error:", error);
          this.pendingResolve([]); // Safe fallback
        }
        // Cleanup after success
        this.currentRequestId = null;
        this.pendingResolve = null;
        // Optional: Terminate worker to free memory if idle? 
        // For now, keep it alive for next request or let Manager handle termination policy.
        // But per requirements: "计算完成后，Worker 应自动销毁或进入休眠，不占用内存。"
        // We can set a timeout to terminate if no new requests come in.
        this.scheduleIdleTermination();
      }
    };
    worker.onerror = (e) => {
      console.error("[H3Worker] Worker Error:", e);
      if (this.pendingResolve) this.pendingResolve([]);
      this.currentRequestId = null;
      this.pendingResolve = null;
    };
    return worker;
  }

  private idleTimeout: NodeJS.Timeout | null = null;

  private scheduleIdleTermination() {
    if (this.idleTimeout) clearTimeout(this.idleTimeout);
    this.idleTimeout = setTimeout(() => {
        this.terminate();
        console.log("[H3Worker] Worker terminated due to inactivity.");
    }, 5000); // 5 seconds idle timeout
  }

  /**
   * Calculate visible cells using debounce strategy.
   * If a new request comes in while previous is running, previous is cancelled (worker terminated).
   */
  public async calculateVisibleCells(coordinates: number[][], resolution: number): Promise<string[]> {
    if (typeof window === "undefined") return [];

    // 1. Concurrency Control: Terminate running worker if any
    if (this.currentRequestId && this.worker) {
      // Previous request is still pending?
      // "如果上一个 Worker 还在计算中，立即调用 terminate() 销毁它。"
      console.log("[H3Worker] Debouncing: Terminating previous worker.");
      this.worker.terminate();
      this.worker = null;
      // Resolve the previous promise with empty (or reject, but empty is safer for UI)
      if (this.pendingResolve) {
          this.pendingResolve([]); 
          this.pendingResolve = null;
      }
    }

    // 2. Create/Get Worker
    if (!this.worker) {
      this.worker = this.createWorker();
    }

    // Clear idle timer since we are active
    if (this.idleTimeout) clearTimeout(this.idleTimeout);

    // 3. Send Request
    return new Promise((resolve) => {
      this.currentRequestId = crypto.randomUUID();
      this.pendingResolve = resolve;

      const message: H3WorkerRequest = {
        id: this.currentRequestId,
        type: 'POLYGON_TO_CELLS',
        payload: {
          coordinates,
          resolution
        }
      };

      this.worker!.postMessage(message);
    });
  }

  public terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.currentRequestId = null;
    this.pendingResolve = null;
    if (this.idleTimeout) clearTimeout(this.idleTimeout);
  }
}

export const h3WorkerManager = H3WorkerManager.getInstance();
