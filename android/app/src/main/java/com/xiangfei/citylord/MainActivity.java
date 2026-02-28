package com.xiangfei.citylord;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 注册 AMap 定位插件（必须在 super.onCreate 之前）
        registerPlugin(AMapLocationPlugin.class);

        super.onCreate(savedInstanceState);
    }
}
