package com.xiangfei.citylord;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;

import java.util.ArrayList;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // 初始化时注册插件（虽然 Capacitor 6 通常自动扫描，但显式调用更保险）
        // this.init(savedInstanceState, new ArrayList<Class<? extends Plugin>>() {{
        //     // Add custom plugins here if needed
        // }});
    }
}
