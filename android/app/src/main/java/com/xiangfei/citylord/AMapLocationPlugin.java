package com.xiangfei.citylord;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.net.Uri;
import android.content.ActivityNotFoundException;
import android.content.ComponentName;
import android.content.pm.PackageManager;
import android.provider.Settings;
import android.util.Log;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import androidx.core.content.ContextCompat;
import androidx.localbroadcastmanager.content.LocalBroadcastManager;

import com.amap.api.location.AMapLocation;
import com.amap.api.location.AMapLocationClient;
import com.amap.api.location.AMapLocationClientOption;
import com.amap.api.location.AMapLocationListener;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import org.json.JSONException;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.xiangfei.citylord.db.AppDatabase;
import com.xiangfei.citylord.db.LocationDao;
import com.xiangfei.citylord.db.LocationEntity;

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
    private BroadcastReceiver trackingLocationReceiver = null;
    private BroadcastReceiver trackingErrorReceiver = null;
    private BroadcastReceiver trackingLogReceiver = null;
    private boolean isTracking = false;

    // Room 数据库异步执行器
    private ExecutorService dbQueryExecutor = null;

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

        // 初始化 Room 查询线程池
        dbQueryExecutor = Executors.newSingleThreadExecutor();
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
    // getOfflineLocations — 从 Room 拉取未同步的离线定位记录
    // -----------------------------------------------------------------------

    /**
     * 根据 sessionId 从 Room 数据库查询所有未同步 (isAcked=false) 的定位记录。
     * JS 层在苏醒后调用此方法，拉取黑匣子中断失的坐标流。
     *
     * 参数:
     *  - sessionId (String, 必须): 跑步会话 ID
     *
     * 返回:
     *  - locations: JSArray，每个元素包含 id, lat, lng, accuracy, speed, bearing, timestamp, isMock
     */
    @PluginMethod()
    public void getOfflineLocations(PluginCall call) {
        String sessionId = call.getString("sessionId");
        if (sessionId == null || sessionId.isEmpty()) {
            call.reject("sessionId 参数不能为空");
            return;
        }

        Log.i(TAG, "getOfflineLocations: sessionId=" + sessionId);

        if (dbQueryExecutor == null) {
            call.reject("数据库查询执行器未初始化");
            return;
        }

        // 异步查询，避免阻塞 Plugin 主线程
        dbQueryExecutor.execute(() -> {
            try {
                LocationDao dao = AppDatabase.getInstance(getContext()).locationDao();
                List<LocationEntity> records = dao.getUnsyncedPoints(sessionId);

                JSArray jsArray = new JSArray();
                for (LocationEntity record : records) {
                    JSObject obj = new JSObject();
                    obj.put("id", record.id);
                    obj.put("lat", record.latitude);
                    obj.put("lng", record.longitude);
                    obj.put("accuracy", record.accuracy);
                    obj.put("speed", record.speed);
                    obj.put("bearing", record.bearing);
                    obj.put("timestamp", record.timestamp);
                    obj.put("isMock", record.isMock);
                    obj.put("coordSystem", "gcj02");
                    jsArray.put(obj);
                }

                JSObject ret = new JSObject();
                ret.put("locations", jsArray);
                ret.put("count", records.size());
                call.resolve(ret);

                Log.i(TAG, "getOfflineLocations 返回 " + records.size() + " 条记录, sessionId=" + sessionId);
            } catch (Exception e) {
                Log.e(TAG, "getOfflineLocations 查询失败: " + e.getMessage(), e);
                call.reject("getOfflineLocations error: " + e.getMessage());
            }
        });
    }

    // -----------------------------------------------------------------------
    // acknowledgeLocations — 标记定位记录为已同步
    // -----------------------------------------------------------------------

    /**
     * 接收 ID 数组，将 Room 数据库中对应记录标记为已同步 (isAcked=true)。
     * JS 层确认处理完毕后调用。
     *
     * 参数:
     *  - ids (number[], 必须): 需要标记的记录 ID 数组
     *
     * 返回:
     *  - acknowledged: 成功标记的记录数
     */
    @PluginMethod()
    public void acknowledgeLocations(PluginCall call) {
        JSArray idsArray = call.getArray("ids");
        if (idsArray == null || idsArray.length() == 0) {
            call.reject("ids 参数不能为空");
            return;
        }

        Log.i(TAG, "acknowledgeLocations: 收到 " + idsArray.length() + " 个 ID");

        if (dbQueryExecutor == null) {
            call.reject("数据库查询执行器未初始化");
            return;
        }

        // 解析 ID 列表
        final List<Long> ids = new ArrayList<>();
        try {
            for (int i = 0; i < idsArray.length(); i++) {
                if (!idsArray.isNull(i)) {
                    ids.add(idsArray.getLong(i)); // 必须使用 getLong
                }
            }
        } catch (JSONException e) {
            call.reject("ids 参数解析失败 (JSONException): " + e.getMessage());
            return;
        }

        // 异步更新
        dbQueryExecutor.execute(() -> {
            try {
                LocationDao dao = AppDatabase.getInstance(getContext()).locationDao();
                dao.setPointsAcked(ids);

                JSObject ret = new JSObject();
                ret.put("acknowledged", ids.size());
                call.resolve(ret);

                Log.i(TAG, "acknowledgeLocations 完成: " + ids.size() + " 条记录已标记");
            } catch (Exception e) {
                Log.e(TAG, "acknowledgeLocations 失败: " + e.getMessage(), e);
                call.reject("acknowledgeLocations error: " + e.getMessage());
            }
        });
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
                                String.valueOf(location.getErrorCode()), (Exception) null);
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

            // ===== BUG FIX: Both modes use Hight_Accuracy (GPS+Network hybrid) =====
            // Previously browse used Battery_Saving (network-only, coarse fixes)
            // and running used Device_Sensors (GPS-only, fails indoors).
            // Hight_Accuracy gives the best of both: accurate like GPS, reliable like network.
            option.setLocationMode(AMapLocationClientOption.AMapLocationMode.Hight_Accuracy);
            option.setSensorEnable(true);
            if ("running".equals(mode)) {
                option.setGpsFirst(true);
                option.setGpsFirstTimeout(5000);
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

        // 关闭数据库查询线程池
        if (dbQueryExecutor != null && !dbQueryExecutor.isShutdown()) {
            dbQueryExecutor.shutdown();
            dbQueryExecutor = null;
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
        String runId = call.getString("runId");
        long startedAt = call.getLong("startedAt", System.currentTimeMillis());

        serviceIntent.putExtra(LocationForegroundService.EXTRA_NOTIFICATION_TITLE, title);
        serviceIntent.putExtra(LocationForegroundService.EXTRA_NOTIFICATION_BODY, body);
        serviceIntent.putExtra(LocationForegroundService.EXTRA_RUN_ID, runId);
        serviceIntent.putExtra(LocationForegroundService.EXTRA_STARTED_AT, startedAt);
        serviceIntent.putExtra(LocationForegroundService.EXTRA_INTERVAL, (long)call.getInt("interval", 2000));

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

    /**
     * 更新前台通知的步数显示。
     * 通知格式："今日 X 步 · 每日跑步语录"
     */
    @PluginMethod()
    public void updateNotificationSteps(PluginCall call) {
        int steps = call.getInt("steps", 0);
        Log.d(TAG, "updateNotificationSteps: " + steps);

        if (!isTracking) {
            Log.w(TAG, "updateNotificationSteps: not tracking, ignoring");
            call.resolve();
            return;
        }

        // Cannot directly access the service instance here, so we send a broadcast
        Intent intent = new Intent("com.xiangfei.citylord.UPDATE_STEPS");
        intent.putExtra("steps", steps);
        androidx.localbroadcastmanager.content.LocalBroadcastManager.getInstance(getContext()).sendBroadcast(intent);
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
                
                // Anti-cheat mock detection
                result.put("isMock", intent.getBooleanExtra(LocationForegroundService.EXTRA_IS_MOCK, false));

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

        // Log event receiver
        trackingLogReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                JSObject log = new JSObject();
                log.put("eventName", intent.getStringExtra(LocationForegroundService.EXTRA_EVENT_NAME));
                log.put("reason", intent.getStringExtra(LocationForegroundService.EXTRA_EVENT_REASON));
                log.put("data", intent.getStringExtra("data"));
                log.put("ts", intent.getLongExtra("ts", System.currentTimeMillis()));
                
                // 给 TS 层统一的事件名，由 TS 转发给埋点系统
                notifyListeners("logEvent", log);
            }
        };
        lbm.registerReceiver(trackingLogReceiver,
                new IntentFilter(LocationForegroundService.ACTION_LOG_EVENT));

        Log.i(TAG, "Tracking BroadcastReceivers registered (Location, Error, Log)");
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

        if (trackingLogReceiver != null) {
            try {
                lbm.unregisterReceiver(trackingLogReceiver);
            } catch (Exception e) {
                Log.w(TAG, "Unregister log receiver error: " + e.getMessage());
            }
            trackingLogReceiver = null;
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
        
        // Anti-cheat mock detection
        obj.put("isMock", location.isMock());

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

    // -----------------------------------------------------------------------
    // openAppPermissionSettings — 跳转权限设置页 (厂商适配 + 兜底)
    // -----------------------------------------------------------------------

    @PluginMethod
    public void openAppPermissionSettings(PluginCall call) {
        JSObject ret = new JSObject();
        
        // 1. 尝试厂商专属页 (方案 B: 绕过 Package Visibility 限制)
        try {
            List<Intent> intents = getManufacturerPermissionIntents();
            for (Intent intent : intents) {
                try {
                    getContext().startActivity(intent);
                    ComponentName component = intent.getComponent();
                    String cmpName = (component != null) ? component.flattenToShortString() : intent.getAction();
                    Log.i(TAG, "Successfully opened manufacturer settings: " + cmpName);
                    
                    ret.put("opened", true);
                    ret.put("route", "manufacturer");
                    ret.put("component", cmpName);
                    call.resolve(ret);
                    return;
                } catch (ActivityNotFoundException | SecurityException e) {
                    // 当前 Intent 不可用，尝试列表中的下一个
                    Log.d(TAG, "Intent not available, trying next: " + intent);
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Manufacturer intent traversal failed: " + e.getMessage());
        }

        // 2. 兜底 1: 标准应用详情页
        try {
            Intent fallback = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            fallback.setData(Uri.parse("package:" + getContext().getPackageName()));
            fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(fallback);
            Log.i(TAG, "Opened app details settings (fallback 1)");
            ret.put("opened", true);
            ret.put("route", "app_details");
            call.resolve(ret);
            return;
        } catch (Exception e) {
            Log.w(TAG, "App details fallback failed: " + e.getMessage());
        }

        // 3. 终极兜底 2: 系统设置首页
        try {
            Intent settings = new Intent(Settings.ACTION_SETTINGS);
            settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(settings);
            Log.i(TAG, "Opened system settings home (fallback 2)");
            ret.put("opened", true);
            ret.put("route", "system_settings");
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Critical error: unable to open any settings page", e);
            call.reject("OPEN_SETTINGS_FAILED", "无法打开任何设置页面: " + e.getMessage());
        }
    }

    private List<Intent> getManufacturerPermissionIntents() {
        List<Intent> intents = new ArrayList<>();
        String manufacturer = Build.MANUFACTURER.toLowerCase(Locale.ROOT);
        String brand = Build.BRAND.toLowerCase(Locale.ROOT);
        String packageName = getContext().getPackageName();

        // 小米/红米/POCO
        if (manufacturer.contains("xiaomi") || brand.contains("xiaomi") ||
            brand.contains("redmi") || brand.contains("poco")) {
            Intent intent = new Intent("miui.intent.action.APP_PERM_EDITOR");
            intent.setClassName("com.miui.securitycenter", "com.miui.permcenter.permissions.PermissionsEditorActivity");
            intent.putExtra("extra_pkgname", packageName);
            intents.add(intent);
        }

        // 华为/荣耀
        if (manufacturer.contains("huawei") || brand.contains("huawei") || brand.contains("honor")) {
            Intent intent1 = new Intent();
            intent1.setComponent(new ComponentName("com.huawei.systemmanager", "com.huawei.permissionmanager.ui.SingleAppActivity"));
            intent1.putExtra("packageName", packageName);
            intents.add(intent1);
            
            Intent intent2 = new Intent();
            intent2.setComponent(new ComponentName("com.android.settings", "com.android.settings.permission.TabItem"));
            intents.add(intent2);
        }

        // OPPO/Realme/一加
        if (manufacturer.contains("oppo") || brand.contains("oppo") || 
            brand.contains("realme") || brand.contains("oneplus")) {
            Intent intent1 = new Intent();
            intent1.setClassName("com.coloros.safecenter", "com.coloros.safecenter.permission.PermissionAppAllPermissionActivity");
            intent1.putExtra("packageName", packageName);
            intents.add(intent1);
            
            Intent intent2 = new Intent();
            intent2.setClassName("com.oppo.safe", "com.oppo.safe.permission.PermissionAppAllPermissionActivity");
            intent2.putExtra("packageName", packageName);
            intents.add(intent2);

            Intent intent3 = new Intent();
            intent3.setClassName("com.coloros.safecenter", "com.coloros.safecenter.permission.PermissionManagerActivity");
            intents.add(intent3);
        }

        // vivo/iQOO
        if (manufacturer.contains("vivo") || brand.contains("vivo") || brand.contains("iqoo")) {
            Intent intent1 = new Intent();
            intent1.setComponent(new ComponentName("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.SoftPermissionDetailActivity"));
            intent1.putExtra("packagename", packageName);
            intents.add(intent1);
            
            Intent intent2 = new Intent();
            intent2.setComponent(new ComponentName("com.iqoo.secure", "com.iqoo.secure.safeguard.SoftPermissionDetailActivity"));
            intent2.putExtra("packagename", packageName);
            intents.add(intent2);
        }

        // 魅族
        if (manufacturer.contains("meizu") || brand.contains("meizu")) {
            Intent intent = new Intent("com.meizu.safe.security.SHOW_APPSEC");
            intent.addCategory(Intent.CATEGORY_DEFAULT);
            intent.putExtra("packageName", packageName);
            intents.add(intent);
        }

        // 为所有 Intent 添加 FLAG_ACTIVITY_NEW_TASK
        for (Intent it : intents) {
            it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        }

        return intents;
    }
}
