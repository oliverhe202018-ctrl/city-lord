package com.xiangfei.citylord.db;

import android.content.Context;

import androidx.room.Database;
import androidx.room.Room;
import androidx.room.RoomDatabase;

/**
 * Room 数据库单例 — 应用级离线存储。
 *
 * 当前版本 1，仅包含 LocationEntity 表。
 * 后续新增表时递增 version 并编写 Migration。
 *
 * 注意：exportSchema = false 避免在 CI 中要求 schema 目录，
 * 生产环境如需版本管理可改为 true。
 */
@Database(entities = {LocationEntity.class}, version = 1, exportSchema = false)
public abstract class AppDatabase extends RoomDatabase {

    /** 获取 LocationDao 实例 */
    public abstract LocationDao locationDao();

    // ---- 单例 ----
    private static volatile AppDatabase INSTANCE;

    /**
     * 获取数据库单例。双重检查锁保证线程安全 + 性能。
     *
     * @param context Application Context（避免 Activity 泄漏）
     * @return AppDatabase 单例
     */
    public static AppDatabase getInstance(Context context) {
        if (INSTANCE == null) {
            synchronized (AppDatabase.class) {
                if (INSTANCE == null) {
                    INSTANCE = Room.databaseBuilder(
                            context.getApplicationContext(),
                            AppDatabase.class,
                            "citylord_offline.db"  // 数据库文件名
                    )
                    // 开发阶段允许破坏性迁移（schema 变更时自动清空重建）
                    // 生产环境请替换为 addMigrations(...)
                    .fallbackToDestructiveMigration()
                    .build();
                }
            }
        }
        return INSTANCE;
    }
}
