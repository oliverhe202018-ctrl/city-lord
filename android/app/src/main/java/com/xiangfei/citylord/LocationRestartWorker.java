package com.xiangfei.citylord;

import android.content.Context;
import android.content.Intent;
import android.os.Build;
import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

public class LocationRestartWorker extends Worker {

    public LocationRestartWorker(@NonNull Context context, @NonNull WorkerParameters workerParams) {
        super(context, workerParams);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context context = getApplicationContext();
        Intent intent = new Intent(context, LocationForegroundService.class);
        
        String runId = getInputData().getString("run_id");
        if (runId != null) {
            intent.putExtra(LocationForegroundService.EXTRA_RUN_ID, runId);
        }
        
        // Android 12+ 限制后台启动前台服务，但 WorkManager 允许一定的宽限期
        try {
            ContextCompat.startForegroundService(context, intent);
        } catch (Exception e) {
            e.printStackTrace();
            return Result.failure();
        }
        
        return Result.success();
    }
}
