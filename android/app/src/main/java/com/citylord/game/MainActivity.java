package com.citylord.game;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

// 引入高德 SDK
import com.amap.api.location.AMapLocation;
import com.amap.api.location.AMapLocationClient;
import com.amap.api.location.AMapLocationClientOption;
import com.amap.api.location.AMapLocationListener;

public class MainActivity extends AppCompatActivity {

    private WebView myWebView;
    // 声明 AMapLocationClient 类对象
    public AMapLocationClient mLocationClient = null;
    // 声明 AMapLocationClientOption 对象
    public AMapLocationClientOption mLocationOption = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        // 1. 动态权限申请（安卓 6.0+ 必须）
        checkPermissions();
        
        // 2. 隐私合规（高德新版必须调用，否则不工作）
        AMapLocationClient.updatePrivacyShow(this, true, true);
        AMapLocationClient.updatePrivacyAgree(this, true);

        // 3. 初始化 WebView
        initWebView();

        // 4. 初始化定位
        initLocation();
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void initWebView() {
        myWebView = findViewById(R.id.webview);
        WebSettings webSettings = myWebView.getSettings();
        webSettings.setJavaScriptEnabled(true); // 开启 JS
        webSettings.setDomStorageEnabled(true);

        // 设置 WebViewClient 保证在当前 APP 打开链接而不是跳浏览器
        // 替换原来的 myWebView.setWebViewClient(new WebViewClient());
        myWebView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                // 只要是 http 或 https 开头的，都强制在当前 WebView 打开
                if (url.startsWith("http:") || url.startsWith("https:")) {
                    view.loadUrl(url);
                    return true; // 返回 true 表示“我处理了，系统浏览器别管”
                }
                return false;
            }
        });

        // 【核心】注入 JS 对象，名字叫 "AndroidApp"
        myWebView.addJavascriptInterface(new WebAppInterface(), "AndroidApp");

        // 加载你的 H5 地址
        // 注意：这里需要根据实际情况替换为你的前端部署地址或局域网 IP
        // 如果是本地调试，请确保手机和电脑在同一局域网，并使用电脑 IP
        myWebView.loadUrl("http://192.168.1.5:3000/login"); 
    }

    private void initLocation() {
        try {
            mLocationClient = new AMapLocationClient(getApplicationContext());
            mLocationOption = new AMapLocationClientOption();
            
            // 设置定位模式：高精度模式 (GPS + 网络)
            mLocationOption.setLocationMode(AMapLocationClientOption.AMapLocationMode.Hight_Accuracy);
            // 获取一次定位结果（根据需要，如果需要持续定位设为 false）
            mLocationOption.setOnceLocation(true);
            
            mLocationClient.setLocationOption(mLocationOption);
            
            // 设置定位回调监听
            mLocationClient.setLocationListener(new AMapLocationListener() {
                @Override
                public void onLocationChanged(AMapLocation aMapLocation) {
                    if (aMapLocation != null) {
                        if (aMapLocation.getErrorCode() == 0) {
                            // 定位成功
                            double lat = aMapLocation.getLatitude();
                            double lng = aMapLocation.getLongitude();
                            String address = aMapLocation.getAddress();

                            // 【关键】回到主线程调用 JS 方法把数据传回去
                            runOnUiThread(() -> {
                                // 调用 H5 的 window.onNativeLocationSuccess 方法
                                String js = "javascript:window.onNativeLocationSuccess(" + lat + ", " + lng + ", '" + address + "')"; 
                                myWebView.evaluateJavascript(js, null);
                            });
                        } else {
                            // 定位失败
                            runOnUiThread(() -> {
                                String js = "javascript:window.onNativeLocationError('ErrCode:" 
                                    + aMapLocation.getErrorCode() + ", " + aMapLocation.getErrorInfo() + "')"; 
                                myWebView.evaluateJavascript(js, null);
                            });
                        }
                    }
                }
            });
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // 【JSBridge 类】定义供 H5 调用的方法
    public class WebAppInterface {
        @JavascriptInterface
        public void startLocation() {
            // H5 调用这个方法开始定位
            if (mLocationClient != null) {
                mLocationClient.startLocation();
            }
        }
        
        @JavascriptInterface
        public void showToast(String toast) {
            Toast.makeText(MainActivity.this, toast, Toast.LENGTH_SHORT).show();
        }
    }

    // 简单的权限检查逻辑
    private void checkPermissions() {
        String[] permissions = { 
                Manifest.permission.ACCESS_FINE_LOCATION, 
                Manifest.permission.ACCESS_COARSE_LOCATION,
                Manifest.permission.WRITE_EXTERNAL_STORAGE,
                Manifest.permission.READ_EXTERNAL_STORAGE,
                Manifest.permission.READ_PHONE_STATE
        };
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) 
                != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, permissions, 1);
            }
        }
    }
}
