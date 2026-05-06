package com.xiangfei.citylord.db;

import androidx.room.Dao;
import androidx.room.Insert;
import androidx.room.OnConflictStrategy;
import androidx.room.Query;

import java.util.List;

/**
 * Room DAO：离线定位记录的数据访问对象。
 *
 * 所有方法都是同步的（非 suspend / 非 LiveData），
 * 调用方必须在后台线程（ExecutorService）中执行。
 */
@Dao
public interface LocationDao {

    /**
     * 插入单条定位记录。
     * 使用 REPLACE 策略：理论上不会冲突（自增 PK），但作为安全兜底。
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    long insert(LocationEntity entity);

    /**
     * 批量插入定位记录（预留接口，用于批量回填场景）。
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    void insertAll(List<LocationEntity> entities);

    /**
     * 查询指定 sessionId 下所有未同步的记录，按时间戳升序排列。
     * JS 层苏醒后调用此方法拉取断失的坐标流。
     */
    @Query("SELECT * FROM location_records WHERE sessionId = :sessionId AND isAcked = 0 ORDER BY timestamp ASC")
    List<LocationEntity> getUnsyncedPoints(String sessionId);

    /**
     * 将指定 ID 列表的记录标记为已同步。
     * JS 层确认处理完毕后调用。
     *
     * @param ids 需要标记的记录 ID 数组
     */
    @Query("UPDATE location_records SET isAcked = 1 WHERE id IN (:ids)")
    void setPointsAcked(List<Long> ids);

    /**
     * 清理已同步的旧数据（超过指定时间戳的已确认记录）。
     * 建议在 Service onCreate 或定时任务中调用，防止数据库无限膨胀。
     *
     * @param olderThan 时间戳阈值，早于此值的已确认记录将被删除
     * @return 删除的行数
     */
    @Query("DELETE FROM location_records WHERE isAcked = 1 AND timestamp < :olderThan")
    int purgeAckedOlderThan(long olderThan);

    /**
     * 获取指定 session 下未同步记录的总数（用于诊断/埋点）。
     */
    @Query("SELECT COUNT(*) FROM location_records WHERE sessionId = :sessionId AND isAcked = 0")
    int getUnsyncedCount(String sessionId);
}
