package com.xiangfei.citylord;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.localbroadcastmanager.content.LocalBroadcastManager;

import com.getcapacitor.JSObject;
import com.amap.api.location.AMapLocation;
import com.amap.api.location.AMapLocationClient;
import com.amap.api.location.AMapLocationClientOption;
import com.amap.api.location.AMapLocationListener;

import android.content.BroadcastReceiver;
import android.content.IntentFilter;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;

import com.xiangfei.citylord.db.AppDatabase;
import com.xiangfei.citylord.db.LocationDao;
import com.xiangfei.citylord.db.LocationEntity;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

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
public class LocationForegroundService extends Service implements AMapLocationListener, SensorEventListener {

    private static final String TAG = "LocationFgSvc";

    // Notification
    private static final String CHANNEL_ID = "citylord_location_channel";
    private static final int NOTIFICATION_ID = 20001;

    // Intent extras
    public static final String EXTRA_NOTIFICATION_TITLE = "extra_notification_title";
    public static final String EXTRA_NOTIFICATION_BODY = "extra_notification_body";
    public static final String EXTRA_INTERVAL = "extra_interval";
    public static final String EXTRA_RUN_ID = "extra_run_id";
    public static final String EXTRA_STARTED_AT = "extra_started_at";

    // Broadcast action — 埋点日志推送
    public static final String ACTION_LOG_EVENT = "com.xiangfei.citylord.LOG_EVENT";
    public static final String EXTRA_EVENT_NAME = "eventName";
    public static final String EXTRA_EVENT_REASON = "reason";

    // Broadcast action — 定位结果推送
    public static final String ACTION_LOCATION_UPDATE = "com.xiangfei.citylord.LOCATION_UPDATE";
    public static final String EXTRA_LAT = "lat";
    public static final String EXTRA_LNG = "lng";
    public static final String EXTRA_ACCURACY = "accuracy";
    public static final String EXTRA_BEARING = "bearing";
    public static final String EXTRA_SPEED = "speed";
    public static final String EXTRA_TIMESTAMP = "timestamp";
    public static final String EXTRA_LOCATION_TYPE = "locationType";
    public static final String EXTRA_IS_MOCK = "isMock";
    public static final String EXTRA_PROVIDER = "provider";
    public static final String EXTRA_ADDRESS = "address";
    public static final String EXTRA_STEPS = "steps";

    // Broadcast action — 错误推送
    public static final String ACTION_LOCATION_ERROR = "com.xiangfei.citylord.LOCATION_ERROR";
    public static final String EXTRA_ERROR_CODE = "errorCode";
    public static final String EXTRA_ERROR_MSG = "errorMsg";



    // AMap client
    private volatile AMapLocationClient locationClient = null;

    // ---- 独立定位线程 (Anti-Doze) ----
    /** 独立 HandlerThread：高德定位回调运行在此线程，不受 Doze 主线程休眠影响 */
    private HandlerThread locationThread = null;
    private Handler locationHandler = null;

    // WakeLock
    private PowerManager.WakeLock wakeLock = null;

    // Steps broadcast receiver (fallback for external step updates)
    private BroadcastReceiver stepsReceiver = null;

    // Hardware step counter
    private SensorManager sensorManager = null;
    private Sensor stepCounterSensor = null;
    private boolean hasStepSensor = false;

    // Steps tracking
    private int currentSteps = 0;
    /** 开机以来的累计步数基准值（今天第一次读到的值） */
    private int stepBaseline = -1;
    /** 今日 0 点的时间戳，用于重置基准 */
    private long todayMidnight = 0;

    // Notification content
    private String notificationTitle = "City Lord";
    private String notificationBody = null;
    private long locationInterval = 60000;
    private String currentRunId = null;
    private long runStartedAt = 0;

    // ---- Room 离线数据库 ----
    private AppDatabase appDatabase = null;
    private LocationDao locationDao = null;
    /** 单线程写入池：保证插入顺序性，不阻塞定位回调主线程 */
    private ExecutorService dbExecutor = null;

    // ---- Daily motivational quotes (60 条，每天不重样) ----
    private static final String[] DAILY_QUOTES = {
        "今天也是元气满满的一天！",
        "每一步都算数，坚持就是胜利。",
        "跑步的人，运气都不会差。",
        "汗水是脂肪的眼泪。",
        "你跑过的路，都会成为你的底气。",
        "不必跑得快，但一定要出发。",
        "跑步治愈一切不开心。",
        "自律给我自由。",
        "跑起来，世界就在脚下。",
        "没有到不了的终点，只有不愿出发的借口。",
        "今日份运动已签到～",
        "坚持跑步，遇见更好的自己。",
        "每一次呼吸，都是与自然的对话。",
        "身体和灵魂，总有一个在路上。",
        "跑步是最省钱的整容方式。",
        "你比昨天的自己更强了！",
        "跑步不是为了到达终点，而是享受路上的风景。",
        "快乐很简单，跑起来就好。",
        "一个人跑步，全世界为你让路。",
        "今天不想动？那就走两步也算赢！",
        "越努力越幸运，越运动越健康。",
        "别等到明天，从今天开始跑起来。",
        "跑步让人上瘾，健康让人自信。",
        "用脚步丈量城市，用汗水书写青春。",
        "让跑步成为习惯，让习惯改变人生。",
        "你流的每一滴汗，都是脂肪在哭泣。",
        "只要迈开腿，就已经赢了大多数人。",
        "跑步的时候，全世界都是你的。",
        "今天跑步了吗？给自己一个赞！",
        "跑步是与内心对话的最佳时刻。",
        "迈出第一步，就是最大的勇敢。",
        "坚持的意义，是成为那个不平凡的自己。",
        "跑步让人清醒，让夜晚安稳。",
        "不是因为厉害才坚持，而是坚持了才厉害。",
        "和风一起奔跑吧！",
        "每一次跑步，都在为未来的自己加分。",
        "跑步不需要天赋，需要的是热爱和坚持。",
        "放下手机，去拥抱阳光和风。",
        "哪怕只是慢跑，也好过原地不动。",
        "生命不止，运动不息。",
        "今天的汗水，是明天的勋章。",
        "奔跑吧，少年！",
        "没有什么烦恼是一次跑步解决不了的。",
        "如果一次不行，那就跑两次。",
        "跑步是给心灵放个假。",
        "把压力踩在脚下，跑出属于你的节奏。",
        "跑步的人生，多一份从容和淡定。",
        "用跑步的方式，认识这座城市。",
        "你每天跑的路，是通往更好自己的路。",
        "太阳出来了，跑步的好天气！",
        "每一公里都值得被记录。",
        "跑步清空大脑，重新出发。",
        "不怕慢，就怕站。",
        "跑步是人生最划算的投资。",
        "微风正好，快去跑步吧。",
        "跑步使我快乐，快乐使我跑步。",
        "越自律，越自由，越运动，越快乐。",
        "你看，你又坚持了一天！",
        "跑起来，你就是这条街最靓的仔！",
        "人生没有白走的路，每一步都算数。",
    };

    /**
     * 根据一年中的确定日期返回每日一句（确定性算法）。
     * 目标：同一天内 App 重启不跳文案，跨天自动换。
     */
    private static String getDailyQuote() {
        java.util.Calendar cal = java.util.Calendar.getInstance();
        int year = cal.get(java.util.Calendar.YEAR);
        int dayOfYear = cal.get(java.util.Calendar.DAY_OF_YEAR);
        // 使用 (年 * 366 + 日) 作为种子，确保日期唯一性
        int seed = year * 366 + dayOfYear;
        return DAILY_QUOTES[seed % DAILY_QUOTES.length];
    }

    // -------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------

    @Override
    public void onCreate() {
        super.onCreate();
        Log.i(TAG, "[Lifecycle] onCreate — creating notification channel and acquiring WakeLock");

        // 1. Create notification channel (Android 8+)
        createNotificationChannel();

        // 2. Acquire PARTIAL_WAKE_LOCK — prevent CPU sleep
        acquireWakeLock();

        // 3. Register steps broadcast receiver (fallback)
        registerStepsReceiver();

        // 4. Register hardware step counter sensor
        registerStepCounterSensor();

        // 5. Calculate today's midnight timestamp
        recalcTodayMidnight();

        // 6. 初始化 Room 离线数据库 + 写入线程池
        initDatabase();
    }

    /**
     * 初始化 Room 数据库单例和写入 Executor。
     * 同时在后台清理 3 天前已确认的旧数据，防止数据库无限膨胀。
     */
    private void initDatabase() {
        try {
            appDatabase = AppDatabase.getInstance(getApplicationContext());
            locationDao = appDatabase.locationDao();
            dbExecutor = Executors.newSingleThreadExecutor();
            Log.i(TAG, "Room 数据库初始化完成");

            // 异步清理 3 天前已确认的旧数据
            final long threeDaysAgo = System.currentTimeMillis() - 3L * 24 * 60 * 60 * 1000;
            dbExecutor.execute(() -> {
                try {
                    int purged = locationDao.purgeAckedOlderThan(threeDaysAgo);
                    if (purged > 0) {
                        Log.i(TAG, "清理已确认的旧记录: " + purged + " 条");
                    }
                } catch (Exception e) {
                    Log.w(TAG, "清理旧数据失败: " + e.getMessage());
                }
            });
        } catch (Exception e) {
            Log.e(TAG, "Room 数据库初始化失败: " + e.getMessage(), e);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // 1. 状态恢复/保存 (优先处理数据状态，避免空指针)
        if (intent == null) {
            Log.w(TAG, "intent is null (Sticky Restart), restoring state from Prefs");
            restoreFromPrefs();
            logEvent("fgs_null_intent_recovered", "sticky_restart");
        } else {
            saveToPrefs(intent);
        }

        logEvent("fgs_start_requested", "ok");

        // 2. 权限预检
        if (!hasLocationPermission()) {
            Log.e(TAG, "Missing location permission, stopping service");
            logEvent("fgs_start_failed", "missing_permission");
            stopSelf();
            return START_NOT_STICKY;
        }

        // 3. 构建并启动前台通知 (Android 14+ 要求在 onStartCommand 早期启动)
        if (notificationBody == null) {
            notificationBody = "定位中… · " + getDailyQuote();
        }
        Notification notification = buildNotification(notificationTitle, notificationBody);
        
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // API 29+ 必须声明类型
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            } else {
                // 低版本平滑退避，避免无效参数异常
                startForeground(NOTIFICATION_ID, notification);
            }
            logEvent("fgs_start_success", "ok");
        } catch (Exception e) {
            Log.e(TAG, "Failed to start foreground: " + e.getMessage());
            logEvent("fgs_start_failed", e.getClass().getSimpleName()); // 补齐埋点
            stopSelf();
            return START_NOT_STICKY;
        }

        // 4. 高德隐私合规
        try {
            AMapLocationClient.updatePrivacyShow(getApplicationContext(), true, true);
            AMapLocationClient.updatePrivacyAgree(getApplicationContext(), true);
        } catch (Exception e) {
            Log.e(TAG, "Privacy compliance failed: " + e.getMessage());
        }

        // 5. 启动定位引擎
        startLocationTracking();

        return START_STICKY;
    }

    private boolean hasLocationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            boolean fine = androidx.core.content.ContextCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_FINE_LOCATION) == android.content.pm.PackageManager.PERMISSION_GRANTED;
            boolean coarse = androidx.core.content.ContextCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_COARSE_LOCATION) == android.content.pm.PackageManager.PERMISSION_GRANTED;
            
            // 埋点快照 (统一命令)
            JSObject snapshot = new JSObject();
            snapshot.put("fine", fine);
            snapshot.put("coarse", coarse);
            broadcastEvent("fgs_permission_snapshot", snapshot.toString()); // 补齐埋点
            
            return fine || coarse;
        }
        return true;
    }

    private void saveToPrefs(Intent intent) {
        String title = intent.getStringExtra(EXTRA_NOTIFICATION_TITLE);
        String body = intent.getStringExtra(EXTRA_NOTIFICATION_BODY);
        if (title != null) notificationTitle = title;
        if (body != null) notificationBody = body;
        
        locationInterval = intent.getLongExtra(EXTRA_INTERVAL, 60000);
        currentRunId = intent.getStringExtra(EXTRA_RUN_ID);
        runStartedAt = intent.getLongExtra(EXTRA_STARTED_AT, System.currentTimeMillis());

        getSharedPreferences("citylord_service_config", MODE_PRIVATE).edit()
            .putString("title", notificationTitle)
            .putString("body", notificationBody)
            .putLong("interval", locationInterval)
            .putString("run_id", currentRunId)
            .putLong("started_at", runStartedAt)
            .apply();
    }

    private void restoreFromPrefs() {
        SharedPreferences sp = getSharedPreferences("citylord_service_config", MODE_PRIVATE);
        notificationTitle = sp.getString("title", "City Lord");
        notificationBody = sp.getString("body", null);
        locationInterval = sp.getLong("interval", 60000);
        currentRunId = sp.getString("run_id", null);
        runStartedAt = sp.getLong("started_at", 0);
    }

    private void logEvent(String name, String reason) {
        Intent intent = new Intent(ACTION_LOG_EVENT);
        intent.putExtra(EXTRA_EVENT_NAME, name);
        intent.putExtra(EXTRA_EVENT_REASON, reason);
        intent.putExtra("ts", System.currentTimeMillis());
        LocalBroadcastManager.getInstance(this).sendBroadcast(intent);
    }

    private void broadcastEvent(String name, String dataJson) {
        Intent intent = new Intent(ACTION_LOG_EVENT);
        intent.putExtra(EXTRA_EVENT_NAME, name);
        intent.putExtra("data", dataJson);
        intent.putExtra("ts", System.currentTimeMillis());
        LocalBroadcastManager.getInstance(this).sendBroadcast(intent);
    }

    @Override
    public void onDestroy() {
        Log.i(TAG, "onDestroy — cleaning up ALL resources");

        // 1. Stop location
        stopLocationTracking();

        // 2. Release WakeLock
        releaseWakeLock();

        // 3. Unregister steps broadcast receiver
        unregisterStepsReceiver();

        // 4. Unregister step counter sensor
        unregisterStepCounterSensor();

        // 5. 关闭数据库写入线程池（等待当前排队任务完成）
        shutdownDbExecutor();

        // 6. Stop foreground & remove notification
        stopForeground(true);

        super.onDestroy();
        Log.i(TAG, "onDestroy — cleanup complete");
    }

    /**
     * 优雅关闭数据库写入线程池。
     * 先尝试正常 shutdown，如 2 秒内未完成则强制 shutdownNow。
     */
    private void shutdownDbExecutor() {
        if (dbExecutor != null && !dbExecutor.isShutdown()) {
            dbExecutor.shutdown();
            try {
                if (!dbExecutor.awaitTermination(2, java.util.concurrent.TimeUnit.SECONDS)) {
                    dbExecutor.shutdownNow();
                    Log.w(TAG, "dbExecutor 强制关闭");
                }
            } catch (InterruptedException e) {
                dbExecutor.shutdownNow();
                Thread.currentThread().interrupt();
            }
            Log.i(TAG, "dbExecutor 已关闭");
        }
    }

    /**
     * 当用户从最近任务列表中清除 App 时，自动重启前台服务。
     * 确保跑步任务不会因为用户误操作而丢失。
     */
    @Override
    public void onTaskRemoved(Intent rootIntent) {
        Log.w(TAG, "onTaskRemoved — user swiped app from recents, scheduling restart");

        // Schedule restart via AlarmManager (1 second delay)
        Intent restartIntent = new Intent(getApplicationContext(), LocationForegroundService.class);
        restartIntent.putExtra(EXTRA_NOTIFICATION_TITLE, notificationTitle);
        restartIntent.putExtra(EXTRA_NOTIFICATION_BODY, notificationBody);

        int pendingFlags = PendingIntent.FLAG_ONE_SHOT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent restartPendingIntent = PendingIntent.getService(
                getApplicationContext(), 1, restartIntent, pendingFlags);

        AlarmManager alarmManager = (AlarmManager) getSystemService(ALARM_SERVICE);
        if (alarmManager != null) {
            alarmManager.set(
                    AlarmManager.ELAPSED_REALTIME_WAKEUP,
                    android.os.SystemClock.elapsedRealtime() + 1000,
                    restartPendingIntent);
            Log.i(TAG, "Restart alarm scheduled for 1 second later");
        }

        super.onTaskRemoved(rootIntent);
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

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(body)
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setOngoing(true)      // Cannot be swiped away
                .setAutoCancel(false)
                .setContentIntent(pendingIntent)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .build();

        // 双重保障：显式设置 FLAG_ONGOING_EVENT | FLAG_NO_CLEAR
        // 部分厂商 ROM（MIUI、华为、OPPO 等）即使 setOngoing(true) 仍可能允许删除
        notification.flags |= Notification.FLAG_ONGOING_EVENT | Notification.FLAG_NO_CLEAR | Notification.FLAG_FOREGROUND_SERVICE;

        return notification;
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

    /**
     * 更新步数并刷新通知内容。
     * 暂时隐藏步数显示，通知格式："定位中… · 每日跑步语录"
     */
    public void updateSteps(int steps) {
        this.currentSteps = steps;
        // 步数暂不显示，仅显示“定位中” + 语录
        // String body = "今日 " + steps + " 步 · " + getDailyQuote();
        // updateNotification(null, body);
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
            // Timeout after 8 hours to cover ultra-marathon scenarios
            wakeLock.acquire(8 * 60 * 60 * 1000L);
            Log.i(TAG, "WakeLock acquired (8h timeout)");
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

        // ====== 创建独立 HandlerThread (Anti-Doze 核心) ======
        // 高德 AMapLocationClient 会绑定到创建它的线程的 Looper。
        // 在独立 HandlerThread 上创建 client，回调天然运行在该线程上，
        // 不受 Doze 模式主线程冻结的影响。
        if (locationThread != null) {
            locationThread.quitSafely();
        }
        locationThread = new HandlerThread("LocationThread", android.os.Process.THREAD_PRIORITY_FOREGROUND);
        locationThread.start();
        locationHandler = new Handler(locationThread.getLooper());
        Log.i(TAG, "独立定位线程已创建: LocationThread (priority=FOREGROUND)");

        // 在独立线程上初始化高德定位引擎
        final Service self = this;
        locationHandler.post(() -> {
            try {
                locationClient = new AMapLocationClient(getApplicationContext());

                AMapLocationClientOption option = new AMapLocationClientOption();
                // User dynamic interval passed from Intent
                option.setInterval(locationInterval);

                option.setLocationMode(AMapLocationClientOption.AMapLocationMode.Hight_Accuracy);
                option.setSensorEnable(true);
                option.setNeedAddress(false);
                // ====== 禁用定位缓存：强制输出实时硬件 GPS 点，杜绝缓存脏点 ======
                option.setLocationCacheEnable(false);
                option.setGpsFirst(true);
                option.setGpsFirstTimeout(5000);

                locationClient.setLocationOption(option);
                locationClient.setLocationListener(LocationForegroundService.this);

                // 启用后台保活 (高德 SDK 要求)
                Notification notification = buildNotification(notificationTitle, notificationBody);
                locationClient.enableBackgroundLocation(NOTIFICATION_ID, notification);

                locationClient.startLocation();

                Log.i(TAG, "AMap location tracking started on LocationThread: Hight_Accuracy, interval=" + locationInterval + "ms, cache=DISABLED");
            } catch (Exception e) {
                Log.e(TAG, "Failed to start location tracking on LocationThread: " + e.getMessage(), e);
                broadcastError(-1, "Start tracking failed: " + e.getMessage());
            }
        });
    }

    private void stopLocationTracking() {
        if (locationClient != null) {
            // 在定位线程上停止 client，确保线程安全
            if (locationHandler != null) {
                locationHandler.post(() -> {
                    try {
                        if (locationClient != null) {
                            locationClient.stopLocation();
                            locationClient.onDestroy();
                            locationClient = null;
                            Log.i(TAG, "AMap location client stopped and destroyed on LocationThread");
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "Error stopping location client: " + e.getMessage(), e);
                        locationClient = null;
                    }
                });
            } else {
                // Fallback: 直接在当前线程停止
                try {
                    locationClient.stopLocation();
                    locationClient.onDestroy();
                    Log.i(TAG, "AMap location client stopped and destroyed (fallback)");
                } catch (Exception e) {
                    Log.e(TAG, "Error stopping location client: " + e.getMessage(), e);
                }
                locationClient = null;
            }
        }

        // 安全退出定位线程
        if (locationThread != null) {
            locationThread.quitSafely();
            Log.i(TAG, "LocationThread quitSafely called");
            locationThread = null;
            locationHandler = null;
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

        // 1a. 持久化缓存位置到 SharedPreferences (兼容旧逻辑)
        saveLocationToCache(location);

        // 1b. 异步写入 Room 数据库（黑匣子核心：即便 JS 挂起也确保每个点落盘）
        persistToRoom(location);



        // 2. Broadcast location to Plugin
        Intent intent = new Intent(ACTION_LOCATION_UPDATE);
        intent.putExtra(EXTRA_LAT, location.getLatitude());
        intent.putExtra(EXTRA_LNG, location.getLongitude());
        intent.putExtra(EXTRA_ACCURACY, location.getAccuracy());
        intent.putExtra(EXTRA_BEARING, location.getBearing());
        intent.putExtra(EXTRA_SPEED, location.getSpeed());
        intent.putExtra(EXTRA_TIMESTAMP, location.getTime());
        intent.putExtra(EXTRA_LOCATION_TYPE, location.getLocationType());
        intent.putExtra(EXTRA_IS_MOCK, location.isMock());

        String provider = location.getProvider();
        if (provider != null && !provider.isEmpty()) {
            intent.putExtra(EXTRA_PROVIDER, provider);
        }
        String address = location.getAddress();
        if (address != null && !address.isEmpty()) {
            intent.putExtra(EXTRA_ADDRESS, address);
        }

        LocalBroadcastManager.getInstance(this).sendBroadcast(intent);
    }

    /**
     * 将位置持久化到 SharedPreferences（轻量快照，用于最后已知位置恢复）
     */
    private void saveLocationToCache(AMapLocation location) {
        SharedPreferences sp = getApplicationContext().getSharedPreferences("citylord_location_cache", android.content.Context.MODE_PRIVATE);
        sp.edit()
            .putLong("last_lat_bits", Double.doubleToRawLongBits(location.getLatitude()))
            .putLong("last_lng_bits", Double.doubleToRawLongBits(location.getLongitude()))
            .putLong("last_timestamp", location.getTime())
            .apply();
        Log.d(TAG, "Location persisted to cache: " + location.getLatitude() + ", " + location.getLongitude());
    }

    /** 记录上一次存入 Room 的位置，用于 2 米过滤 */
    private AMapLocation lastRoomLocation = null;

    /**
     * 异步将定位点写入 Room 数据库。
     * 关键设计：即使 JS/WebView 进程完全挂起，此方法仍在 Native Service 线程中执行，
     * 确保每一个 GPS 采样点都完成 dao.insert()。
     */
    private void persistToRoom(AMapLocation location) {
        if (locationDao == null || dbExecutor == null) {
            Log.w(TAG, "Room 数据库未初始化，跳过持久化");
            return;
        }

        // --- 2 米过滤逻辑 ---
        float distance = 100f;
        if (lastRoomLocation != null) {
            float[] results = new float[1];
            android.location.Location.distanceBetween(
                    lastRoomLocation.getLatitude(), lastRoomLocation.getLongitude(),
                    location.getLatitude(), location.getLongitude(),
                    results
            );
            distance = results[0];
        }

        if (lastRoomLocation != null && distance < 2.0f) {
            return; // 静止或抖动，跳过写入 DB
        }

        lastRoomLocation = location.clone();
        // ------------------

        // 使用当前 runId 作为 sessionId；如果没有 runId 则使用 "idle" 标记
        final String sessionId = (currentRunId != null && !currentRunId.isEmpty())
                ? currentRunId : "idle";

        final LocationEntity entity = new LocationEntity();
        entity.sessionId = sessionId;
        entity.latitude = location.getLatitude();
        entity.longitude = location.getLongitude();
        entity.timestamp = location.getTime();
        entity.isAcked = false;
        entity.accuracy = location.getAccuracy();
        entity.speed = location.getSpeed();
        entity.bearing = location.getBearing();
        entity.isMock = location.isMock();

        dbExecutor.execute(() -> {
            try {
                long rowId = locationDao.insert(entity);
                // 降低日志噪音：每 50 条打印一次
                if (rowId % 50 == 0) {
                    Log.d(TAG, "Room 持久化 #" + rowId + " session=" + sessionId);
                }
            } catch (Exception e) {
                Log.e(TAG, "Room insert 失败: " + e.getMessage());
            }
        });
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

    // -------------------------------------------------------------------
    // Steps broadcast receiver
    // -------------------------------------------------------------------

    private void registerStepsReceiver() {
        stepsReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(android.content.Context context, Intent intent) {
                int steps = intent.getIntExtra("steps", 0);
                Log.d(TAG, "Received steps broadcast: " + steps);
                updateSteps(steps);
            }
        };
        IntentFilter filter = new IntentFilter("com.xiangfei.citylord.UPDATE_STEPS");
        LocalBroadcastManager.getInstance(this).registerReceiver(stepsReceiver, filter);
    }

    private void unregisterStepsReceiver() {
        if (stepsReceiver != null) {
            try {
                LocalBroadcastManager.getInstance(this).unregisterReceiver(stepsReceiver);
            } catch (Exception e) {
                Log.w(TAG, "Failed to unregister steps receiver: " + e.getMessage());
            }
            stepsReceiver = null;
        }
    }

    // -------------------------------------------------------------------
    // Hardware Step Counter Sensor
    // -------------------------------------------------------------------

    private void registerStepCounterSensor() {
        sensorManager = (SensorManager) getSystemService(SENSOR_SERVICE);
        if (sensorManager == null) {
            Log.w(TAG, "SensorManager not available");
            return;
        }

        stepCounterSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
        if (stepCounterSensor == null) {
            Log.w(TAG, "TYPE_STEP_COUNTER sensor not available on this device");
            hasStepSensor = false;
            return;
        }

        hasStepSensor = true;
        sensorManager.registerListener(this, stepCounterSensor, SensorManager.SENSOR_DELAY_UI);
        Log.i(TAG, "Hardware step counter sensor registered");
    }

    private void unregisterStepCounterSensor() {
        if (sensorManager != null && hasStepSensor) {
            sensorManager.unregisterListener(this);
            Log.i(TAG, "Hardware step counter sensor unregistered");
        }
        sensorManager = null;
        stepCounterSensor = null;
        hasStepSensor = false;
    }

    /**
     * TYPE_STEP_COUNTER 回调：返回开机以来的累计步数。
     * 我们通过保存“今天第一次读到的值”作为基准，差值就是今日步数。
     * 如果跨天（当前时间 > todayMidnight + 24h），重置基准。
     */
    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() != Sensor.TYPE_STEP_COUNTER) return;

        int totalStepsSinceBoot = (int) event.values[0];
        long now = System.currentTimeMillis();

        // 跨天重置基准
        if (now >= todayMidnight + 24 * 60 * 60 * 1000L) {
            recalcTodayMidnight();
            stepBaseline = totalStepsSinceBoot;
            Log.i(TAG, "New day detected, resetting step baseline to " + stepBaseline);
        }

        // 第一次读取：设置基准
        if (stepBaseline < 0) {
            stepBaseline = totalStepsSinceBoot;
            Log.i(TAG, "Step baseline set to " + stepBaseline);
        }

        int todaySteps = totalStepsSinceBoot - stepBaseline;
        if (todaySteps < 0) todaySteps = 0; // 设备重启后基准可能大于当前值

        // 只在步数变化时记录（暂不更新通知）
        if (todaySteps != currentSteps) {
            currentSteps = todaySteps;
            // 步数暂不显示在通知中，后续启用时取消以下注释
            // String body = "今日 " + currentSteps + " 步 · " + getDailyQuote();
            // updateNotification(null, body);
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        // Not needed for step counter
    }

    /**
     * 计算今天 0:00:00 的时间戳
     */
    private void recalcTodayMidnight() {
        java.util.Calendar cal = java.util.Calendar.getInstance();
        cal.set(java.util.Calendar.HOUR_OF_DAY, 0);
        cal.set(java.util.Calendar.MINUTE, 0);
        cal.set(java.util.Calendar.SECOND, 0);
        cal.set(java.util.Calendar.MILLISECOND, 0);
        todayMidnight = cal.getTimeInMillis();
    }
}
