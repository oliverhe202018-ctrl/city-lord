/**
 * KalmanFilter1D — 一维卡尔曼滤波器
 *
 * 用于 GPS 坐标平滑（lat / lng 各一个实例）。
 * 相比 EMA，Kalman 滤波器能根据测量噪声与过程噪声自适应调整融合权重，
 * 在 GPS 信号抖动大时给出更稳定的推算值，信号好时快速跟随真实位置。
 *
 * 状态模型：
 *   x = [position, velocity]
 *   使用恒速模型（constant velocity model），
 *   过程噪声 Q 和测量噪声 R 的比值决定滤波器响应灵敏度。
 *
 * 使用方式：
 *   const kfLat = new KalmanFilter1D();
 *   const kfLng = new KalmanFilter1D();
 *   const smoothedLat = kfLat.filter(rawLat, timestamp);
 *   const smoothedLng = kfLng.filter(rawLng, timestamp);
 */

export class KalmanFilter1D {
    // 状态向量: [position, velocity]
    private x: number = 0;    // 位置估计
    private v: number = 0;    // 速度估计

    // 误差协方差矩阵 (2x2, 但我们用标量近似分量)
    private p00: number = 1000; // position variance
    private p01: number = 0;
    private p10: number = 0;
    private p11: number = 1000; // velocity variance

    /** 过程噪声功率谱密度 — 控制对加速度变化的容忍度 */
    private processNoisePSD: number;

    /** 测量噪声方差（米²） — GPS 精度的期望值 */
    private readonly measurementNoiseVar: number;

    /** 是否已初始化 */
    private initialized: boolean = false;

    /** 上一次更新的时间戳（ms） */
    private lastTimestamp: number = 0;

    /**
     * @param processNoisePSD 过程噪声功率谱密度。值越大 → 滤波器越信任新测量 → 响应更快但更抖。
     *                         跑步场景推荐 3.0（平衡平滑与响应性）。
     * @param measurementNoiseVar 测量噪声方差。值越大 → 滤波器越平滑 → 响应越慢。
     *                              GPS精度约 5m 时建议 25（5²），10m 时 100。
     */
    constructor(processNoisePSD: number = 3.0, measurementNoiseVar: number = 25.0) {
        this.processNoisePSD = processNoisePSD;
        this.measurementNoiseVar = measurementNoiseVar;
    }

    /**
     * 动态设置过程噪声功率谱密度
     */
    setProcessNoisePSD(psd: number): void {
        this.processNoisePSD = psd;
    }

    /**
     * 信号恢复时重置位置与协方差，清空速度估计
     */
    resetToPosition(newPosition: number, accuracy: number = 50): void {
        this.x = newPosition;
        this.v = 0;
        this.p00 = accuracy * accuracy;
        this.p01 = 0;
        this.p10 = 0;
        this.p11 = 1000;
        this.initialized = true;
    }

    /**
     * 输入一个新的测量值，返回滤波后的位置估计。
     *
     * @param measurement 原始测量值（纬度或经度）
     * @param timestamp   测量时间戳（ms）
     * @param accuracy    可选：GPS 精度（米），用于动态调整测量噪声
     * @param isStationary 是否处于静止锁定（ZUPT）状态
     * @returns 滤波后的位置估计值
     */
    filter(measurement: number, timestamp: number, accuracy?: number, isStationary: boolean = false): number {
        if (!this.initialized) {
            this.x = measurement;
            this.v = 0;
            this.p00 = 1000;
            this.p01 = 0;
            this.p10 = 0;
            this.p11 = 1000;
            this.lastTimestamp = timestamp;
            this.initialized = true;
            return measurement;
        }

        // 计算时间间隔（秒）— 限制最小步长为 0.1s 以阻断分母接近零导致的数值爆炸
        const dt = Math.max(0.1, (timestamp - this.lastTimestamp) / 1000);
        this.lastTimestamp = timestamp;

        // 限制 dt 防止长时间暂停后的大跳跃
        const dtClamped = Math.min(dt, 10.0);

        // ====== PREDICT 阶段 ======

        // 状态预测: x' = x + v * dt
        const xPred = this.x + this.v * dtClamped;
        const vPred = this.v; // 恒速模型

        // 过程噪声 Q (离散白噪声加速度模型)
        const dt2 = dtClamped * dtClamped;
        const dt3 = dt2 * dtClamped;
        const dt4 = dt3 * dtClamped;
        const q = this.processNoisePSD;

        const q00 = q * dt4 / 4;
        const q01 = q * dt3 / 2;
        const q10 = q01;
        const q11 = q * dt2;

        // 协方差预测: P' = F * P * F^T + Q
        // F = [[1, dt], [0, 1]]
        const p00Pred = this.p00 + dtClamped * (this.p10 + this.p01) + dt2 * this.p11 + q00;
        const p01Pred = this.p01 + dtClamped * this.p11 + q01;
        const p10Pred = this.p10 + dtClamped * this.p11 + q10;
        const p11Pred = this.p11 + q11;

        // 动态测量噪声：如果提供了 GPS accuracy，使用 accuracy²；如果是静止锁定状态，放大 R 以抑制 GPS 测量更新
        let R = accuracy != null && accuracy > 0
            ? accuracy * accuracy
            : this.measurementNoiseVar;

        if (isStationary) {
            R *= 4.0; // 放大测量误差，高度信任预测值（自身状态），压制噪声输入
        }

        // 创新（residual）
        const y = measurement - xPred;

        // 创新协方差: S = H * P' * H^T + R (H = [1, 0])
        const S = p00Pred + R;

        // 卡尔曼增益: K = P' * H^T / S
        const k0 = p00Pred / S;
        const k1 = p10Pred / S;

        // 状态更新: x = x' + K * y
        this.x = xPred + k0 * y;
        
        // 限制速度估计值在 [-15.0, 15.0] 范围内，防止直角拐弯处数值过冲或三角形折叠
        const rawNextV = vPred + k1 * y;
        if (isStationary) {
            this.v = 0; // 静止时强制速度估计为 0
        } else if (Math.abs(rawNextV) > 15.0) {
            console.log(`[Kalman-Stable] Velocity state clamped. Corner trajectory smoothed.`);
            this.v = Math.max(-15.0, Math.min(15.0, rawNextV));
        } else {
            this.v = rawNextV;
        }

        // 协方差更新: P = (I - K * H) * P'
        this.p00 = (1 - k0) * p00Pred;
        this.p01 = (1 - k0) * p01Pred;
        this.p10 = p10Pred - k1 * p00Pred;
        this.p11 = p11Pred - k1 * p01Pred;

        return this.x;
    }

    /**
     * 获取当前估计的速度（坐标单位/秒）
     */
    getVelocity(): number {
        return this.v;
    }

    /**
     * 获取当前位置估计的不确定性（标准差，坐标单位）
     */
    getUncertainty(): number {
        return Math.sqrt(Math.max(0, this.p00));
    }

    /**
     * 预测未来某个时间点的位置（不更新状态）
     * @param dtMs 距当前的时间差（ms）
     * @returns 预测位置
     */
    predict(dtMs: number): number {
        if (!this.initialized) return this.x;
        const dtSec = dtMs / 1000;
        return this.x + this.v * dtSec;
    }

    /**
     * 重置滤波器状态
     */
    reset(): void {
        this.initialized = false;
        this.x = 0;
        this.v = 0;
        this.p00 = 1000;
        this.p01 = 0;
        this.p10 = 0;
        this.p11 = 1000;
        this.lastTimestamp = 0;
    }

    /** 是否已初始化 */
    get isInitialized(): boolean {
        return this.initialized;
    }
}
