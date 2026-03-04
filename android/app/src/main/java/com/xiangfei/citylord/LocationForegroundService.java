package com.xiangfei.citylord;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.localbroadcastmanager.content.LocalBroadcastManager;

import com.amap.api.location.AMapLocation;
import com.amap.api.location.AMapLocationClient;
import com.amap.api.location.AMapLocationClientOption;
import com.amap.api.location.AMapLocationListener;

/**
 * LocationForegroundService — Android 前台定位服务
 *
 * 在 Service 内部运行 AMapLocationClient，确保锁屏/切后台/黑屏后仍持续获取高精度定位。
 * 定位结果通过 LocalBroadcast 推送至 AMapLocationPlugin，再由 Capacitor notifyListeners
 * 传递给 JS/TS 层。
 *
 * 关键能力：
 *  - startForeground() 常驻通知
 *  - PARTIAL_WAKE_LOCK 防止 CPU 休眠
 *  - AMapLocationClient 高精度、2s 间隔连续定位
 *  - 动态更新通知内容（支持从 Plugin 端传入 title/body）
 *  - onDestroy 完整资源释放（防止内存泄漏 & 电量浪费）
 */
public class LocationForegroundService extends Service implements AMapLocationListener {

    private static final String TAG = "LocationFgSvc";

    // Notification
    private static final String CHANNEL_ID = "citylord_location_channel";
    private static final int NOTIFICATION_ID = 20001;

    // Intent extras
    public static final String EXTRA_NOTIFICATION_TITLE = "notification_title";
    public static final String EXTRA_NOTIFICATION_BODY = "notification_body";

    // Broadcast action — 定位结果推送
    public static final String ACTION_LOCATION_UPDATE = "com.xiangfei.citylord.LOCATION_UPDATE";
    public static final String EXTRA_LAT = "lat";
    public static final String EXTRA_LNG = "lng";
    public static final String EXTRA_ACCURACY = "accuracy";
    public static final String EXTRA_BEARING = "bearing";
    public static final String EXTRA_SPEED = "speed";
    public static final String EXTRA_TIMESTAMP = "timestamp";
    public static final String EXTRA_LOCATION_TYPE = "locationType";
    public static final String EXTRA_PROVIDER = "provider";
    public static final String EXTRA_ADDRESS = "address";

    // Broadcast action — 错误推送
    public static final String ACTION_LOCATION_ERROR = "com.xiangfei.citylord.LOCATION_ERROR";
    public static final String EXTRA_ERROR_CODE = "errorCode";
    public static final String EXTRA_ERROR_MSG = "errorMsg";

    // AMap client
    private AMapLocationClient locationClient = null;

    // WakeLock
    private PowerManager.WakeLock wakeLock = null;

    // Notification content
    private String notificationTitle = "City Lord";
    private String notificationBody = "正在追踪您的位置…";

    // -------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------

    @Override
    public void onCreate() {
        super.onCreate();
        Log.i(TAG, "onCreate — creating notification channel and acquiring WakeLock");

        // 1. Create notification channel (Android 8+)
        createNotificationChannel();

        // 2. Acquire PARTIAL_WAKE_LOCK — prevent CPU sleep
        acquireWakeLock();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.i(TAG, "onStartCommand — starting foreground service and location tracking");

        // Read notification content from intent
        if (intent != null) {
            String title = intent.getStringExtra(EXTRA_NOTIFICATION_TITLE);
            String body = intent.getStringExtra(EXTRA_NOTIFICATION_BODY);
            if (title != null && !title.isEmpty()) notificationTitle = title;
            if (body != null && !body.isEmpty()) notificationBody = body;
        }

        // 1. Start foreground IMMEDIATELY (Android 12+ requires this within 5s)
        Notification notification = buildNotification(notificationTitle, notificationBody);
        startForeground(NOTIFICATION_ID, notification);

        // 2. AMap privacy compliance — must call before AMapLocationClient
        try {
            AMapLocationClient.updatePrivacyShow(getApplicationContext(), true, true);
            AMapLocationClient.updatePrivacyAgree(getApplicationContext(), true);
        } catch (Exception e) {
            Log.e(TAG, "Privacy compliance failed: " + e.getMessage(), e);
        }

        // 3. Start location tracking
        startLocationTracking();

        // START_STICKY: if killed, system will restart the service
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        Log.i(TAG, "onDestroy — cleaning up ALL resources");

        // 1. Stop location
        stopLocationTracking();

        // 2. Release WakeLock
        releaseWakeLock();

        // 3. Stop foreground & remove notification
        stopForeground(true);

        super.onDestroy();
        Log.i(TAG, "onDestroy — cleanup complete");
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null; // Started service, no binding
    }

    // -------------------------------------------------------------------
    // Notification Channel & Builder
    // -------------------------------------------------------------------

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "位置追踪",
                    NotificationManager.IMPORTANCE_LOW // Low: no sound, shows in status bar
            );
            channel.setDescription("跑步定位追踪服务");
            channel.setShowBadge(false);

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
                Log.i(TAG, "Notification channel created: " + CHANNEL_ID);
            }
        }
    }

    private Notification buildNotification(String title, String body) {
        // Tap notification → open MainActivity
        Intent launchIntent = new Intent(this, MainActivity.class);
        launchIntent.setAction(Intent.ACTION_MAIN);
        launchIntent.addCategory(Intent.CATEGORY_LAUNCHER);
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, launchIntent, pendingFlags);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(body)
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setOngoing(true)      // Cannot be swiped away
                .setAutoCancel(false)
                .setContentIntent(pendingIntent)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .build();
    }

    /**
     * 动态更新通知内容（可由 Plugin 调用，例如显示距离/时间等）
     */
    public void updateNotification(String title, String body) {
        if (title != null) notificationTitle = title;
        if (body != null) notificationBody = body;

        Notification notification = buildNotification(notificationTitle, notificationBody);
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) {
            manager.notify(NOTIFICATION_ID, notification);
        }
    }

    // -------------------------------------------------------------------
    // WakeLock
    // -------------------------------------------------------------------

    private void acquireWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) return;

        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK,
                    "CityLord::LocationWakeLock"
            );
            // Timeout after 4 hours to prevent infinite hold
            wakeLock.acquire(4 * 60 * 60 * 1000L);
            Log.i(TAG, "WakeLock acquired (4h timeout)");
        }
    }

    private void releaseWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) {
            try {
                wakeLock.release();
                Log.i(TAG, "WakeLock released");
            } catch (Exception e) {
                Log.w(TAG, "WakeLock release error: " + e.getMessage());
            }
            wakeLock = null;
        }
    }

    // -------------------------------------------------------------------
    // AMap Location Tracking
    // -------------------------------------------------------------------

    private void startLocationTracking() {
        if (locationClient != null) {
            Log.w(TAG, "Location client already running, stopping first");
            stopLocationTracking();
        }

        try {
            locationClient = new AMapLocationClient(getApplicationContext());

            AMapLocationClientOption option = new AMapLocationClientOption();
            // 高精度模式（GPS + 网络混合）
            option.setLocationMode(AMapLocationClientOption.AMapLocationMode.Hight_Accuracy);
            // 2000ms 定位间隔
            option.setInterval(2000);
            // 不需要逆地理编码（节省功耗）
            option.setNeedAddress(false);
            // 启用缓存
            option.setLocationCacheEnable(true);
            // GPS 优先（仅在 Device_Sensors 下生效，但设上不影响）
            option.setGpsFirst(true);
            // GPS 首次获取超时
            option.setGpsFirstTimeout(5000);

            locationClient.setLocationOption(option);
            locationClient.setLocationListener(this);
            locationClient.startLocation();

            Log.i(TAG, "AMap location tracking started: Hight_Accuracy, interval=2000ms");
        } catch (Exception e) {
            Log.e(TAG, "Failed to start location tracking: " + e.getMessage(), e);
            broadcastError(-1, "Start tracking failed: " + e.getMessage());
        }
    }

    private void stopLocationTracking() {
        if (locationClient != null) {
            try {
                locationClient.stopLocation();
                locationClient.onDestroy();
                Log.i(TAG, "AMap location client stopped and destroyed");
            } catch (Exception e) {
                Log.e(TAG, "Error stopping location client: " + e.getMessage(), e);
            }
            locationClient = null;
        }
    }

    // -------------------------------------------------------------------
    // AMapLocationListener
    // -------------------------------------------------------------------

    @Override
    public void onLocationChanged(AMapLocation location) {
        if (location == null) {
            Log.w(TAG, "onLocationChanged: null location");
            return;
        }

        if (location.getErrorCode() != 0) {
            Log.w(TAG, "Location error: code=" + location.getErrorCode()
                    + " info=" + location.getErrorInfo());
            broadcastError(location.getErrorCode(), location.getErrorInfo());
            return;
        }

        // Broadcast location to Plugin
        Intent intent = new Intent(ACTION_LOCATION_UPDATE);
        intent.putExtra(EXTRA_LAT, location.getLatitude());
        intent.putExtra(EXTRA_LNG, location.getLongitude());
        intent.putExtra(EXTRA_ACCURACY, location.getAccuracy());
        intent.putExtra(EXTRA_BEARING, location.getBearing());
        intent.putExtra(EXTRA_SPEED, location.getSpeed());
        intent.putExtra(EXTRA_TIMESTAMP, location.getTime());
        intent.putExtra(EXTRA_LOCATION_TYPE, location.getLocationType());

        String provider = location.getProvider();
        if (provider != null && !provider.isEmpty()) {
            intent.putExtra(EXTRA_PROVIDER, provider);
        }
        String address = location.getAddress();
        if (address != null && !address.isEmpty()) {
            intent.putExtra(EXTRA_ADDRESS, address);
        }

        LocalBroadcastManager.getInstance(this).sendBroadcast(intent);

        Log.d(TAG, "Location broadcast: lat=" + location.getLatitude()
                + " lng=" + location.getLongitude()
                + " accuracy=" + location.getAccuracy()
                + " type=" + location.getLocationType());
    }

    // -------------------------------------------------------------------
    // Error broadcasting
    // -------------------------------------------------------------------

    private void broadcastError(int code, String message) {
        Intent intent = new Intent(ACTION_LOCATION_ERROR);
        intent.putExtra(EXTRA_ERROR_CODE, code);
        intent.putExtra(EXTRA_ERROR_MSG, message != null ? message : "Unknown error");
        LocalBroadcastManager.getInstance(this).sendBroadcast(intent);
    }
}
