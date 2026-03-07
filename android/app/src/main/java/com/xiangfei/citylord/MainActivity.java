package com.xiangfei.citylord;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "MainActivity";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 注册 AMap 定位插件（必须在 super.onCreate 之前）
        registerPlugin(AMapLocationPlugin.class);

        super.onCreate(savedInstanceState);
    }

    @Override
    public void onResume() {
        super.onResume();
        // 引导用户关闭电池优化（首次进入时弹出系统对话框）
        requestIgnoreBatteryOptimization();
    }

    @Override
    public void onDestroy() {
        // ⚠️ 关键：Activity 销毁时不要停止前台 Service
        // 前台 Service 独立于 Activity 生命周期运行
        Log.i(TAG, "onDestroy — Activity destroyed, foreground service will continue running");
        super.onDestroy();
    }

    /**
     * 请求系统将本 App 加入电池优化白名单。
     * 在国产 ROM（MIUI、华为、OPPO、Vivo 等）上，
     * 不加入白名单的 App 在后台很容易被杀掉。
     */
    private void requestIgnoreBatteryOptimization() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())) {
                try {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + getPackageName()));
                    startActivity(intent);
                    Log.i(TAG, "Requested battery optimization exemption");
                } catch (Exception e) {
                    Log.w(TAG, "Failed to request battery optimization exemption: " + e.getMessage());
                }
            }
        }
    }
}
