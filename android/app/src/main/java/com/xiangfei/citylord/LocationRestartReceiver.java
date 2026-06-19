package com.xiangfei.citylord;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

/**
 * LocationRestartReceiver — 接收 AlarmManager 精确闹钟广播，自动重启前台定位服务。
 * 
 * 作为 MIUI/OriginOS 等深度定制 ROM 杀进程后的强制唤醒兜底机制。
 * 当 LocationForegroundService 被系统强制回收后，AlarmManager 会在 5 分钟后触发此 Receiver，
 * 重新启动前台服务以确保跑步轨迹不中断。
 */
public class LocationRestartReceiver extends BroadcastReceiver {
    
    private static final String TAG = "LocationRestartRcv";
    
    @Override
    public void onReceive(Context context, Intent intent) {
        Log.i(TAG, "Received restart alarm, attempting to restart LocationForegroundService");
        
        try {
            // 构建重启 Intent
            Intent serviceIntent = new Intent(context, LocationForegroundService.class);
            serviceIntent.setAction("com.xiangfei.citylord.RESTART_SERVICE");
            
            // Android 8.0+ 必须使用 startForegroundService
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
                Log.i(TAG, "Started foreground service (API 26+)");
            } else {
                context.startService(serviceIntent);
                Log.i(TAG, "Started service (API < 26)");
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to restart service: " + e.getMessage(), e);
        }
    }
}
