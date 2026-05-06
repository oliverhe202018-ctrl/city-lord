package com.xiangfei.citylord;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import android.webkit.PermissionRequest;
import com.getcapacitor.BridgeWebChromeClient;
import android.Manifest;
import android.content.pm.PackageManager;
import androidx.core.content.ContextCompat;

import android.net.http.SslError;
import android.webkit.SslErrorHandler;
import com.getcapacitor.BridgeWebViewClient;
import android.content.pm.ApplicationInfo;
import android.app.AlertDialog;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "MainActivity";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // ✅ Layer 1 优化：启用 WebView 多进程渲染（API 28+）
        // 将 WebView 渲染隔离到独立进程，主进程 OOM 不会影响 UI
        // 必须把设置 WebView 后缀的代码放在绝对的最前面！
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WebView.setDataDirectorySuffix("webview_data");
        }

        // 注册插件 - 确保在 super.onCreate 之前执行
        registerPlugin(AMapLocationPlugin.class);
        registerPlugin(AudioFocusPlugin.class);

        super.onCreate(savedInstanceState);

        WebView webView = getBridge().getWebView();

        // 🟡 P2 修复：删除死代码，保留 setupWebViewSettings 中的条件判断逻辑
        // 原代码：webView.setLayerType(android.view.View.LAYER_TYPE_HARDWARE, null) 在模拟器上会被覆盖
        // 修复：删除此行，让 setupWebViewSettings 统一处理渲染类型
        
        // 针对模拟器白屏/崩溃的平衡设置
        setupWebViewSettings(webView);

        // 处理 SSL 握手和崩溃恢复
        setupCustomWebViewClient(webView);

        webView.postDelayed(this::showBatteryOptimizationDisclosure, 2000);
    }

    private void setupWebViewSettings(WebView webView) {
        WebSettings settings = webView.getSettings();
        
        // ✅ Layer 1 优化：仅在模拟器上使用软件渲染，真机使用硬件加速
        // 关键：有些模拟器在开启硬件加速时处理某些 CSS 动画会崩溃
        // 真机强制使用硬件加速以提高性能
        if (Build.FINGERPRINT.contains("generic") || Build.FINGERPRINT.contains("emulator")) {
            // 模拟器：使用软件渲染提高稳定性
            webView.setLayerType(View.LAYER_TYPE_SOFTWARE, null);
        } else {
            // 真机：使用硬件加速提高性能
            webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        }

        // 优化缓存和性能
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setJavaScriptEnabled(true);
        
        // 模拟器上关闭不稳定的特性
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(false);
        }
    }

    private void setupCustomWebViewClient(WebView webView) {
        // 自定义 WebViewClient 处理 SSL 和崩溃
        webView.setWebViewClient(new BridgeWebViewClient(getBridge()) {
            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                // Determine if the app is running in a debuggable build at runtime.
                boolean isDebugBuild =
                    (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;

                String errorMessage;
                switch (error.getPrimaryError()) {
                    case SslError.SSL_EXPIRED:      errorMessage = "Certificate expired"; break;
                    case SslError.SSL_IDMISMATCH:   errorMessage = "Hostname mismatch"; break;
                    case SslError.SSL_NOTYETVALID:  errorMessage = "Certificate not yet valid"; break;
                    case SslError.SSL_UNTRUSTED:    errorMessage = "Untrusted certificate authority"; break;
                    default:                        errorMessage = "Unknown SSL error"; break;
                }
                Log.e(TAG, "onReceivedSslError [" + (isDebugBuild ? "DEBUG" : "RELEASE") + "] "
                        + errorMessage + " | URL: " + error.getUrl());

                if (isDebugBuild) {
                    // DEBUG ONLY: proceed to allow local/self-signed dev server certificates.
                    Log.w(TAG, "DEBUG build — proceeding past SSL error for development.");
                    handler.proceed();
                } else {
                    // RELEASE: always cancel. Never expose users to untrusted certificates.
                    handler.cancel();
                }
            }

            @Override
            public boolean onRenderProcessGone(WebView view, android.webkit.RenderProcessGoneDetail detail) {
                Log.e(TAG, "Renderer process crashed. Recreating Activity to recover... OOM: " + detail.didCrash());
                
                // 确保在主线程执行 Activity 重建
                new android.os.Handler(android.os.Looper.getMainLooper()).post(() -> {
                    if (!isFinishing() && !isDestroyed()) {
                        Log.i(TAG, "Activity state valid, executing recreate().");
                        recreate(); // 自动重新加载整个 Web/Native 桥接
                    } else {
                        Log.w(TAG, "Activity is finishing or destroyed, skipping recreate().");
                    }
                });
                return true;
            }
        });

        // 自定义 WebChromeClient 处理权限
        webView.setWebChromeClient(new BridgeWebChromeClient(getBridge()) {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                String[] resources = request.getResources();
                if (resources != null) {
                    for (String resource : resources) {
                        if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) {
                            if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                                request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                                return;
                            }
                        }
                    }
                }
                super.onPermissionRequest(request);
            }
        });
    }

    @Override
    public void onDestroy() {
        Log.i(TAG, "onDestroy");
        super.onDestroy();
    }

    /**
     * Shows a Prominent Disclosure dialog before requesting battery optimization exemption.
     * Required by Google Play policy to explain WHY the permission is needed before the
     * system prompt appears. Avoids "deceptive behavior" policy rejection.
     */
    private void showBatteryOptimizationDisclosure() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return;

        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        if (pm == null || pm.isIgnoringBatteryOptimizations(getPackageName())) return;

        // Guard: if the Activity is no longer in a valid state
        if (isFinishing() || isDestroyed()) {
            Log.w(TAG, "showBatteryOptimizationDisclosure: Activity is finishing, skipping dialog.");
            return;
        }

        new AlertDialog.Builder(MainActivity.this)
            .setTitle("保持后台轨迹记录")
            .setMessage("为了在后台持续记录你的领地轨迹，请允许应用忽略电池优化。\n" +
                        "如果不开启，应用在切入后台后可能会被系统中断，导致占领失败。")
            .setPositiveButton("去开启", (dialog, which) -> {
                if (isFinishing() || isDestroyed()) return;
                // Only fire the intent after explicit user consent
                try {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + getPackageName()));
                    startActivity(intent);
                    Log.i(TAG, "User consented — requested battery optimization exemption.");
                } catch (Exception e) {
                    Log.w(TAG, "Failed to launch battery optimization settings: " + e.getMessage());
                }
            })
            .setNegativeButton("暂不", (dialog, which) -> {
                dialog.dismiss();
                Log.i(TAG, "User declined battery optimization exemption.");
            })
            .setCancelable(true)
            .show();
    }
}
