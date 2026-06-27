package com.xiangfei.citylord;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

/**
 * PR 4.3C: 增加 user_stopped_running 标志检查，防止用户主动停止跑步后误触发重启。
 */
public class LocationRestartWorker extends Worker {

    private static final String TAG = "LocationRestartWkr";
    private static final String PREFS_NAME = "citylord_service_config";
    private static final String KEY_USER_STOPPED = "user_stopped_running";

    public LocationRestartWorker(@NonNull Context context, @NonNull WorkerParameters workerParams) {
        super(context, workerParams);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context context = getApplicationContext();

        // PR 4.3C: 检查用户是否已主动停止跑步
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        if (prefs.getBoolean(KEY_USER_STOPPED, false)) {
            Log.i(TAG, "[PR4.3C] user_stopped_running=true, skipping restart");
            return Result.success();
        }

        Intent intent = new Intent(context, LocationForegroundService.class);
        
        String runId = getInputData().getString("run_id");
        if (runId != null) {
            intent.putExtra(LocationForegroundService.EXTRA_RUN_ID, runId);
        }
        
        // Android 12+ 限制后台启动前台服务，但 WorkManager 允许一定的宽限期
        try {
            ContextCompat.startForegroundService(context, intent);
            Log.i(TAG, "[PR4.3C] Restarting foreground service via WorkManager");
        } catch (Exception e) {
            Log.e(TAG, "Failed to restart service: " + e.getMessage(), e);
            return Result.failure();
        }
        
        return Result.success();
    }
}
