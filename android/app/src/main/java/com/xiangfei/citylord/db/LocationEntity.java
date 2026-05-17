package com.xiangfei.citylord.db;

import androidx.room.ColumnInfo;
import androidx.room.Entity;
import androidx.room.Index;
import androidx.room.PrimaryKey;

/**
 * Room 实体：离线定位记录。
 *
 * 每一个 GPS 采样点在 Service 的 onLocationResult 中被插入此表。
 * 当 JS 层苏醒后，通过 Plugin 的 getOfflineLocations 按 sessionId 拉取，
 * 并在确认处理完毕后调用 acknowledgeLocations 将 isAcked 标记为 true。
 *
 * 索引策略：
 *  - (sessionId, isAcked) 组合索引 → 加速 getUnsyncedPoints 查询
 */
@Entity(
    tableName = "location_records",
    indices = {
        @Index(value = {"sessionId", "isAcked"})
    }
)
public class LocationEntity {

    /** 自增主键 */
    @PrimaryKey(autoGenerate = true)
    public long id;

    /** 跑步会话 ID（对应 TS 层 runId），用于按次分组 */
    @ColumnInfo(name = "sessionId")
    public String sessionId;

    /** 纬度 (GCJ-02) */
    @ColumnInfo(name = "latitude")
    public double latitude;

    /** 经度 (GCJ-02) */
    @ColumnInfo(name = "longitude")
    public double longitude;

    /** GPS 采样时间戳 (毫秒) */
    @ColumnInfo(name = "timestamp")
    public long timestamp;

    /** 是否已被 JS 层确认同步 */
    @ColumnInfo(name = "isAcked", defaultValue = "0")
    public boolean isAcked;

    /** 定位精度 (米) */
    @ColumnInfo(name = "accuracy", defaultValue = "0")
    public float accuracy;

    /** 速度 (米/秒) */
    @ColumnInfo(name = "speed", defaultValue = "0")
    public float speed;

    /** 方向角 */
    @ColumnInfo(name = "bearing", defaultValue = "0")
    public float bearing;

    /** 是否为模拟定位 */
    @ColumnInfo(name = "isMock", defaultValue = "0")
    public boolean isMock;
}
