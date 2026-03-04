package com.xiangfei.citylord;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.util.Log;

import androidx.core.content.ContextCompat;
import androidx.localbroadcastmanager.content.LocalBroadcastManager;

import com.amap.api.location.AMapLocation;
import com.amap.api.location.AMapLocationClient;
import com.amap.api.location.AMapLocationClientOption;
import com.amap.api.location.AMapLocationListener;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * AMapLocationPlugin — Capacitor 插件：Android 高德定位 SDK
 *
 * 返回坐标固定为 GCJ-02，TS 层直接写入 store，禁止再做坐标转换。
 *
 * TODO: Foreground Service（跑步后台定位）— 待后续扩展
 */
@CapacitorPlugin(name = "AMapLocation")
public class AMapLocationPlugin extends Plugin {

    private static final String TAG = "AMapLocationPlugin";

    private AMapLocationClient onceClient = null;
    private AMapLocationClient watchClient = null;
    private boolean privacyShown = false;
    private boolean privacyAgreed = false;

    // Foreground service tracking state
    private boolean isTracking = false;
    private BroadcastReceiver trackingLocationReceiver = null;
    private BroadcastReceiver trackingErrorReceiver = null;

    // -----------------------------------------------------------------------
    // Plugin lifecycle
    // -----------------------------------------------------------------------

    @Override
    public void load() {
        super.load();
        Log.i(TAG, "Plugin loaded — calling privacy compliance APIs");

        // 隐私合规：必须在 AMapLocationClient 构造前调用
        try {
            AMapLocationClient.updatePrivacyShow(getContext(), true, true);
            AMapLocationClient.updatePrivacyAgree(getContext(), true);
            privacyShown = true;
            privacyAgreed = true;
            Log.i(TAG, "Privacy compliance calls completed in load()");
        } catch (Exception e) {
            Log.e(TAG, "Privacy compliance failed in load(): " + e.getMessage(), e);
        }
    }

    // -----------------------------------------------------------------------
    // Privacy compliance (TS 层也可主动调用)
    // -----------------------------------------------------------------------

    @PluginMethod()
    public void updatePrivacyShow(PluginCall call) {
        boolean isContains = call.getBoolean("isContains", true);
        boolean isShow = call.getBoolean("isShow", true);
        try {
            AMapLocationClient.updatePrivacyShow(getContext(), isContains, isShow);
            privacyShown = true;
            Log.i(TAG, "updatePrivacyShow: isContains=" + isContains + " isShow=" + isShow);
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "updatePrivacyShow failed: " + e.getMessage(), e);
            call.reject("updatePrivacyShow failed: " + e.getMessage());
        }
    }

    @PluginMethod()
    public void updatePrivacyAgree(PluginCall call) {
        boolean isAgree = call.getBoolean("isAgree", true);
        try {
            AMapLocationClient.updatePrivacyAgree(getContext(), isAgree);
            privacyAgreed = true;
            Log.i(TAG, "updatePrivacyAgree: isAgree=" + isAgree);
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "updatePrivacyAgree failed: " + e.getMessage(), e);
            call.reject("updatePrivacyAgree failed: " + e.getMessage());
        }
    }

    // -----------------------------------------------------------------------
    // getCurrentPosition — 一次定位
    // -----------------------------------------------------------------------

    @PluginMethod()
    public void getCurrentPosition(PluginCall call) {
        if (!ensurePrivacyCompliance(call)) return;

        String mode = call.getString("mode", "fast");
        int timeout = call.getInt("timeout", 8000);
        int cacheMaxAge = call.getInt("cacheMaxAge", 5000);

        Log.i(TAG, "getCurrentPosition: mode=" + mode + " timeout=" + timeout + " cacheMaxAge=" + cacheMaxAge);

        try {
            // 每次一次定位创建新 client，避免复用导致回调混乱
            if (onceClient != null) {
                try {
                    onceClient.stopLocation();
                    onceClient.onDestroy();
                } catch (Exception e) {
                    Log.w(TAG, "onceClient cleanup error: " + e.getMessage());
                }
            }

            onceClient = new AMapLocationClient(getContext());

            AMapLocationClientOption option = new AMapLocationClientOption();
            option.setLocationMode(AMapLocationClientOption.AMapLocationMode.Hight_Accuracy);
            option.setOnceLocation(true);
            option.setOnceLocationLatest(true);
            option.setHttpTimeOut(timeout);
            option.setNeedAddress(false);

            // cacheMaxAge: 允许接受最近几秒的 SDK 缓存（冷启动避免永远等待）
            if ("fast".equals(mode) && cacheMaxAge > 0) {
                // AMap SDK 没有直接 cacheMaxAge 参数，但通过不设置 interval=0
                // + setOnceLocationLatest(true) 可以获取 SDK 内部缓存
                option.setLocationCacheEnable(true);
            } else {
                option.setLocationCacheEnable(false);
            }

            onceClient.setLocationOption(option);
            onceClient.setLocationListener(new AMapLocationListener() {
                @Override
                public void onLocationChanged(AMapLocation location) {
                    if (location == null) {
                        Log.e(TAG, "getCurrentPosition: null location returned");
                        call.reject("Location is null");
                        return;
                    }

                    if (location.getErrorCode() != 0) {
                        Log.e(TAG, "getCurrentPosition error: code=" + location.getErrorCode()
                                + " info=" + location.getErrorInfo());
                        JSObject error = new JSObject();
                        error.put("code", location.getErrorCode());
                        error.put("message", location.getErrorInfo());
                        call.reject("Location error: " + location.getErrorInfo(),
                                String.valueOf(location.getErrorCode()), null);
                        return;
                    }

                    JSObject result = locationToJSObject(location);
                    Log.i(TAG, "getCurrentPosition success: lat=" + location.getLatitude()
                            + " lng=" + location.getLongitude()
                            + " accuracy=" + location.getAccuracy()
                            + " type=" + location.getLocationType());
                    call.resolve(result);

                    // 清理一次性 client
                    try {
                        if (onceClient != null) {
                            onceClient.stopLocation();
                            onceClient.onDestroy();
                            onceClient = null;
                        }
                    } catch (Exception e) {
                        Log.w(TAG, "onceClient cleanup after success: " + e.getMessage());
                    }
                }
            });

            onceClient.startLocation();

        } catch (Exception e) {
            Log.e(TAG, "getCurrentPosition exception: " + e.getMessage(), e);
            call.reject("getCurrentPosition failed: " + e.getMessage());
        }
    }

    // -----------------------------------------------------------------------
    // startWatch — 连续定位
    // -----------------------------------------------------------------------

    @PluginMethod()
    public void startWatch(PluginCall call) {
        if (!ensurePrivacyCompliance(call)) return;

        String mode = call.getString("mode", "browse");
        int interval = call.getInt("interval", "browse".equals(mode) ? 5000 : 1000);
        int distanceFilter = call.getInt("distanceFilter", "browse".equals(mode) ? 10 : 3);

        Log.i(TAG, "startWatch: mode=" + mode + " interval=" + interval + " distanceFilter=" + distanceFilter);

        try {
            // 先 stop 已有 watch
            stopWatchInternal();

            watchClient = new AMapLocationClient(getContext());

            AMapLocationClientOption option = new AMapLocationClientOption();

            if ("running".equals(mode)) {
                // 跑步：高频高精度（GPS 传感器优先）
                option.setLocationMode(AMapLocationClientOption.AMapLocationMode.Device_Sensors);
            } else {
                // 浏览：低功耗（网络+GPS 混合，省电）
                option.setLocationMode(AMapLocationClientOption.AMapLocationMode.Battery_Saving);
            }

            option.setInterval(interval);
            option.setNeedAddress(false);
            option.setLocationCacheEnable(true);

            watchClient.setLocationOption(option);
            watchClient.setLocationListener(new AMapLocationListener() {
                @Override
                public void onLocationChanged(AMapLocation location) {
                    if (location == null) return;

                    if (location.getErrorCode() != 0) {
                        Log.w(TAG, "watch error: code=" + location.getErrorCode()
                                + " info=" + location.getErrorInfo());
                        JSObject error = new JSObject();
                        error.put("code", location.getErrorCode());
                        error.put("message", location.getErrorInfo());
                        notifyListeners("locationError", error);
                        return;
                    }

                    JSObject result = locationToJSObject(location);
                    notifyListeners("locationUpdate", result);
                }
            });

            watchClient.startLocation();

            JSObject ret = new JSObject();
            ret.put("watchId", "amap-watch-" + System.currentTimeMillis());
            call.resolve(ret);

        } catch (Exception e) {
            Log.e(TAG, "startWatch exception: " + e.getMessage(), e);
            call.reject("startWatch failed: " + e.getMessage());
        }
    }

    // -----------------------------------------------------------------------
    // stopWatch — 停止连续定位
    // -----------------------------------------------------------------------

    @PluginMethod()
    public void stopWatch(PluginCall call) {
        Log.i(TAG, "stopWatch called");
        stopWatchInternal();
        call.resolve();
    }

    private void stopWatchInternal() {
        if (watchClient != null) {
            try {
                watchClient.stopLocation();
                watchClient.onDestroy();
            } catch (Exception e) {
                Log.w(TAG, "stopWatch error: " + e.getMessage());
            }
            watchClient = null;
        }
    }

    // -----------------------------------------------------------------------
    // Plugin cleanup
    // -----------------------------------------------------------------------

    @Override
    protected void handleOnDestroy() {
        Log.i(TAG, "handleOnDestroy — cleaning up all clients");
        stopWatchInternal();
        stopTrackingInternal();
        if (onceClient != null) {
            try {
                onceClient.stopLocation();
                onceClient.onDestroy();
            } catch (Exception e) {
                Log.w(TAG, "onceClient cleanup in onDestroy: " + e.getMessage());
            }
            onceClient = null;
        }
        super.handleOnDestroy();
    }

    // -----------------------------------------------------------------------
    // forceDestroy — 强制销毁（stop 超时保护）
    // -----------------------------------------------------------------------

    /**
     * 强制销毁所有 AMapLocationClient 实例。
     * 在 TS 层 safeStopWatch 检测到 stopWatch 超时时调用。
     * 清理所有资源并通过 locationError 事件通知 TS 层。
     */
    @PluginMethod()
    public void forceDestroy(PluginCall call) {
        Log.w(TAG, "forceDestroy — forcibly destroying all location clients");

        // 销毁 watchClient
        if (watchClient != null) {
            try {
                watchClient.stopLocation();
                watchClient.onDestroy();
            } catch (Exception e) {
                Log.e(TAG, "forceDestroy watchClient error: " + e.getMessage());
            }
            watchClient = null;
        }

        // 销毁 onceClient
        if (onceClient != null) {
            try {
                onceClient.stopLocation();
                onceClient.onDestroy();
            } catch (Exception e) {
                Log.e(TAG, "forceDestroy onceClient error: " + e.getMessage());
            }
            onceClient = null;
        }

        // 通知 TS 层（错误事件，保持向后兼容）
        JSObject error = new JSObject();
        error.put("code", "FORCE_DESTROY");
        error.put("message", "All location clients forcibly destroyed due to stop timeout");
        notifyListeners("locationError", error);

        // 新增确认事件 — 通知 JS 层可安全调用 removeAllListeners 做最终清理
        JSObject confirmed = new JSObject();
        confirmed.put("code", "FORCE_DESTROY_CONFIRMED");
        confirmed.put("message", "All clients destroyed, JS should removeAllListeners");
        notifyListeners("locationError", confirmed);

        Log.i(TAG, "forceDestroy complete — all clients destroyed, TS notified with FORCE_DESTROY + FORCE_DESTROY_CONFIRMED");
        call.resolve();
    }

    // -----------------------------------------------------------------------
    // startTracking / stopTracking — Foreground Service 定位
    // -----------------------------------------------------------------------

    /**
     * 启动前台定位 Service + 注册 BroadcastReceiver 接收定位更新。
     * 定位在 Service 内运行，锁屏/后台/黑屏均可持续。
     *
     * Options:
     *  - notificationTitle: 通知标题（默认 "City Lord"）
     *  - notificationBody:  通知内容（默认 "正在追踪您的位置…"）
     */
    @PluginMethod()
    public void startTracking(PluginCall call) {
        if (isTracking) {
            Log.w(TAG, "startTracking: already tracking, ignoring");
            call.resolve();
            return;
        }

        Log.i(TAG, "startTracking — launching foreground service");

        // 1. Register BroadcastReceivers to relay Service → JS
        registerTrackingReceivers();

        // 2. Start foreground service
        Intent serviceIntent = new Intent(getContext(), LocationForegroundService.class);

        String title = call.getString("notificationTitle", "City Lord");
        String body = call.getString("notificationBody", "正在追踪您的位置…");
        serviceIntent.putExtra(LocationForegroundService.EXTRA_NOTIFICATION_TITLE, title);
        serviceIntent.putExtra(LocationForegroundService.EXTRA_NOTIFICATION_BODY, body);

        // Android O+ requires startForegroundService
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(serviceIntent);
        } else {
            getContext().startService(serviceIntent);
        }

        isTracking = true;
        Log.i(TAG, "startTracking — foreground service started, receivers registered");
        call.resolve();
    }

    /**
     * 停止前台定位 Service + 注销 BroadcastReceivers。
     * 完整清理所有资源，通知栏常驻通知自动移除。
     */
    @PluginMethod()
    public void stopTracking(PluginCall call) {
        Log.i(TAG, "stopTracking called");
        stopTrackingInternal();
        call.resolve();
    }

    private void stopTrackingInternal() {
        if (!isTracking) {
            Log.d(TAG, "stopTrackingInternal: not tracking, skipping");
            return;
        }

        // 1. Stop foreground service
        try {
            Intent serviceIntent = new Intent(getContext(), LocationForegroundService.class);
            getContext().stopService(serviceIntent);
            Log.i(TAG, "Foreground service stopped");
        } catch (Exception e) {
            Log.e(TAG, "Error stopping foreground service: " + e.getMessage(), e);
        }

        // 2. Unregister receivers
        unregisterTrackingReceivers();

        isTracking = false;
        Log.i(TAG, "stopTrackingInternal complete — service stopped, receivers unregistered");
    }

    private void registerTrackingReceivers() {
        LocalBroadcastManager lbm = LocalBroadcastManager.getInstance(getContext());

        // Location update receiver
        trackingLocationReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                JSObject result = new JSObject();
                result.put("lat", intent.getDoubleExtra(LocationForegroundService.EXTRA_LAT, 0));
                result.put("lng", intent.getDoubleExtra(LocationForegroundService.EXTRA_LNG, 0));
                result.put("accuracy", intent.getFloatExtra(LocationForegroundService.EXTRA_ACCURACY, 0));
                result.put("bearing", intent.getFloatExtra(LocationForegroundService.EXTRA_BEARING, 0));
                result.put("speed", intent.getFloatExtra(LocationForegroundService.EXTRA_SPEED, 0));
                result.put("timestamp", intent.getLongExtra(LocationForegroundService.EXTRA_TIMESTAMP, 0));
                result.put("coordSystem", "gcj02");
                result.put("locationType", intent.getIntExtra(LocationForegroundService.EXTRA_LOCATION_TYPE, 0));

                String provider = intent.getStringExtra(LocationForegroundService.EXTRA_PROVIDER);
                if (provider != null && !provider.isEmpty()) {
                    result.put("provider", provider);
                }
                String address = intent.getStringExtra(LocationForegroundService.EXTRA_ADDRESS);
                if (address != null && !address.isEmpty()) {
                    result.put("address", address);
                }

                notifyListeners("locationUpdate", result);
            }
        };
        lbm.registerReceiver(trackingLocationReceiver,
                new IntentFilter(LocationForegroundService.ACTION_LOCATION_UPDATE));

        // Error receiver
        trackingErrorReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                JSObject error = new JSObject();
                error.put("code", intent.getIntExtra(LocationForegroundService.EXTRA_ERROR_CODE, -1));
                error.put("message", intent.getStringExtra(LocationForegroundService.EXTRA_ERROR_MSG));
                notifyListeners("locationError", error);
            }
        };
        lbm.registerReceiver(trackingErrorReceiver,
                new IntentFilter(LocationForegroundService.ACTION_LOCATION_ERROR));

        Log.i(TAG, "Tracking BroadcastReceivers registered");
    }

    private void unregisterTrackingReceivers() {
        LocalBroadcastManager lbm = LocalBroadcastManager.getInstance(getContext());

        if (trackingLocationReceiver != null) {
            try {
                lbm.unregisterReceiver(trackingLocationReceiver);
            } catch (Exception e) {
                Log.w(TAG, "Unregister location receiver error: " + e.getMessage());
            }
            trackingLocationReceiver = null;
        }

        if (trackingErrorReceiver != null) {
            try {
                lbm.unregisterReceiver(trackingErrorReceiver);
            } catch (Exception e) {
                Log.w(TAG, "Unregister error receiver error: " + e.getMessage());
            }
            trackingErrorReceiver = null;
        }

        Log.i(TAG, "Tracking BroadcastReceivers unregistered");
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private boolean ensurePrivacyCompliance(PluginCall call) {
        if (!privacyShown || !privacyAgreed) {
            Log.e(TAG, "Privacy compliance not completed. Call updatePrivacyShow + updatePrivacyAgree first.");
            call.reject("Privacy compliance not completed");
            return false;
        }
        return true;
    }

    /**
     * Convert AMapLocation to JSObject payload.
     * coordSystem 固定为 'gcj02' — AMap 原生返回永远是 GCJ-02。
     */
    private JSObject locationToJSObject(AMapLocation location) {
        JSObject obj = new JSObject();
        obj.put("lat", location.getLatitude());
        obj.put("lng", location.getLongitude());
        obj.put("accuracy", location.getAccuracy());
        obj.put("bearing", location.getBearing());
        obj.put("speed", location.getSpeed());
        obj.put("timestamp", location.getTime());
        obj.put("coordSystem", "gcj02");
        obj.put("locationType", location.getLocationType());

        String address = location.getAddress();
        if (address != null && !address.isEmpty()) {
            obj.put("address", address);
        }

        String provider = location.getProvider();
        if (provider != null && !provider.isEmpty()) {
            obj.put("provider", provider);
        }

        return obj;
    }
}
