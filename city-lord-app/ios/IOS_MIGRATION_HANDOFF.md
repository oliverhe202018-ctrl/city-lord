# City Lord iOS 迁移落地总结与 macOS 接力指南

## 一、Phase 1~4 完成状态总览

| 阶段 | 目标 | 状态 | 关键交付物 |
|------|------|------|-----------|
| Phase 1 | 版本对齐与 iOS 基础权限配置 | 完成 | iOS 壳工程重新初始化、Info.plist 权限声明、Capacitor v8 统一 |
| Phase 2 | 定位核心与后台保活 | 代码完成 | `AMapLocationPlugin.swift`（CoreLocation 过渡实现，含 GCJ-02 转换） |
| Phase 3 | 离线数据库持久化（黑匣子） | 代码完成 | `LocationRecord.swift` + `LocationDatabase.swift`（GRDB.swift） |
| Phase 4 | 辅助原生插件补齐 | 代码完成 | `AudioFocusPlugin.swift` + 社区插件确认集成 |

## 二、关键已实现能力

### 1. 定位能力（AMapLocationPlugin）
- `getCurrentPosition` / `startWatch` / `stopWatch`
- `startTracking` / `stopTracking`（后台定位 `allowsBackgroundLocationUpdates = true`）
- 坐标输出格式统一为 GCJ-02（当前通过 WGS-84 → GCJ-02 算法转换）
- `isMock` 启发式检测（基于 `horizontalAccuracy` 与 iOS 15+ 模拟标记）
- Android 特有接口（电池优化、ROM 信息）已设为 iOS no-op

### 2. 离线数据库（GRDB.swift）
- 表名 `location_records`，字段与 Android `LocationEntity` 一致
- `getOfflineLocations` / `acknowledgeLocations` / `hydrateOfflinePoints`
- `beginBackgroundTask` 保护后台写入事务

### 3. 音频焦点（AudioFocusPlugin）
- `requestDucking`：`AVAudioSession.playback + .duckOthers`
- `abandonDucking`：恢复后台音乐音量
- 监听 `AVAudioSession.interruptionNotification` 处理中断恢复

### 4. 已自动集成的社区插件
- `@capacitor-community/text-to-speech`（iOS 原生 `AVSpeechSynthesizer`）
- `@capgo/capacitor-pedometer`（iOS 原生 `CMPedometer`）

## 三、macOS 接力操作指南

### 环境要求
- macOS 12+
- Xcode 15+
- CocoaPods 1.12+（如需接入 AMapLocation SDK）
- Python 3 / Node.js 环境（已在前端工程中存在）

### 步骤 1：打开工程并恢复 GRDB 依赖

```bash
cd city-lord-app/ios
npx cap sync ios
pwsh ./apply-grdb-to-package-swift.ps1
```

> `apply-grdb-to-package-swift.ps1` 是必须的，因为 Capacitor CLI 会重写 `CapApp-SPM/Package.swift` 并移除 GRDB.swift 依赖。

### 步骤 2：集成 AMapLocation iOS SDK（推荐 CocoaPods）

当前 `AMapLocationPlugin.swift` 使用 CoreLocation 作为过渡方案，生产环境建议替换为高德 iOS 定位 SDK。

```bash
cd city-lord-app/ios/App
# 创建 Podfile
cat > Podfile <<EOF
platform :ios, '15.0'
use_frameworks!
target 'App' do
  pod 'AMapLocation'
end
EOF
pod install
```

然后在 Xcode 中：
1. 打开 `App.xcworkspace`
2. 将 `AMapLocationPlugin.swift` 中 `import CoreLocation` 替换为 `import AMapLocation`
3. 将 `CLLocationManager` 替换为 `AMapLocationManager`
4. 删除 WGS-84 → GCJ-02 转换，直接透传高德返回的 GCJ-02 坐标
5. 在 `AppDelegate.swift` 中配置 `AMapServices.shared().apiKey = "YOUR_AMAP_KEY"`

### 步骤 3：Xcode 编译与真机运行

1. 用 Xcode 打开 `city-lord-app/ios/App/App.xcworkspace`
2. 选择真机目标（iOS 模拟器无法测试后台定位）
3. 确认 Signing & Capabilities 中开启了：
   - Background Modes: Location updates
   - Background Modes: Audio
4. 编译并运行

### 步骤 4：功能验证清单

- [ ] App 启动无崩溃
- [ ] 定位权限弹窗文案正常
- [ ] `AMapLocation.getCurrentPosition()` 返回 GCJ-02 坐标
- [ ] `AMapLocation.startWatch({ mode: 'running' })` 持续回调
- [ ] 切到后台 5 分钟后仍能收到 `locationUpdate` 事件
- [ ] 断网状态下跑步轨迹点写入 SQLite
- [ ] 恢复网络/前台后 `getOfflineLocations` 能拉取未同步点
- [ ] `acknowledgeLocations` 后再次拉取不再返回已 ACK 点
- [ ] TTS 播报时背景音乐自动降低，播报结束后恢复
- [ ] 计步器数据正常返回

### 步骤 5：生产环境替换 CoreLocation（重要）

如果决定保留 CoreLocation，请确保：
- WGS-84 → GCJ-02 转换算法在真机中国境内精度可接受
- 后台定位稳定性满足领地闭合需求

如果替换为 AMapLocation SDK：
- 确认返回坐标为 GCJ-02
- 在调用任何定位前完成 `updatePrivacyShow` + `updatePrivacyAgree`

## 四、已知限制与风险

1. **当前为代码实现阶段，未经过 iOS 真机编译验证**：Swift 语法细节可能在 Xcode 首次编译时需要微调。
2. **AMapLocation SDK 未实际集成**：当前坐标转换依赖算法实现，非高德 SDK 原生输出。
3. **`npx cap sync ios` 会覆盖 `Package.swift`**：每次 sync 后必须运行恢复脚本。
4. **后台定位测试必须真机**：模拟器无法验证 `allowsBackgroundLocationUpdates` 行为。
5. **AudioFocus 与 TTS 音频会话可能冲突**：需在真机上验证播报音量控制是否平滑。

## 五、Android 回归验证结果

- `.\gradlew.bat assembleDebug` 在全部四阶段后均构建成功。
- 最终 APK 下载链接：https://d8.tfdl.net/public/2026-06-29/30a40e52-7832-41fd-a198-01fcdfe275bd/app-debug.apk

## 六、后续建议

1. 在 macOS 环境中建立 CI/CD 流水线，自动执行 `xcodebuild` 编译和 Archive。
2. 接入高德 AMapLocation SDK 后，删除 CoreLocation 过渡代码。
3. 考虑将 `AMapLocationPlugin` 和 `AudioFocusPlugin` 抽离为独立 npm 包，避免 `packageClassList` 和手动注册问题。
4. 对离线数据库增加单元测试，验证 ACK 机制和批量插入性能。
