# City Lord iOS 定位插件集成说明

## 当前状态

Phase 2 已完成 `AMapLocationPlugin.swift` 的编写，并集成到 Capacitor v8 iOS 工程中。

**关键说明**：由于当前开发环境为 Windows，无法运行 Xcode / CocoaPods / Swift 编译器，因此 `AMapLocationPlugin.swift` 目前采用 **CoreLocation (`CLLocationManager`) 作为过渡实现**。所有坐标在返回前均通过 WGS-84 → GCJ-02 转换算法处理，以保证与 Android 端高德 SDK 返回的 `gcj02` 坐标一致。

## 文件位置

- 插件源码：`ios/App/CapApp-SPM/Sources/CapApp-SPM/AMapLocationPlugin.swift`
- 配置：`ios/App/App/capacitor.config.json` 已注册 `AMapLocationPlugin`
- AppDelegate：`ios/App/App/AppDelegate.swift` 已预留高德 Key 配置位置

## 生产环境建议：替换为 AMapLocation iOS SDK

为了严格满足"底层返回 GCJ-02 坐标系"的要求，建议在 macOS + Xcode 环境中完成以下替换：

### 方案 A：CocoaPods 集成（推荐）

1. 在 `ios/App` 目录下创建 `Podfile`：
   ```ruby
   platform :ios, '15.0'
   use_frameworks!
   target 'App' do
     pod 'AMapLocation'
   end
   ```
2. 运行 `pod install`。
3. 将 `AMapLocationPlugin.swift` 中的 `import CoreLocation` 替换为 `import AMapLocation`。
4. 将 `CLLocationManager` 相关逻辑替换为 `AMapLocationManager`。
5. 删除 WGS-84 → GCJ-02 转换，直接透传高德返回的 GCJ-02 坐标。

### 方案 B：手动导入 xcframework

1. 从高德开发者平台下载 `AMapLocation.xcframework`。
2. 放置到 `ios/App/Frameworks/AMapLocation.xcframework`。
3. 在 Xcode 中将其添加到 `App` target 的 Frameworks, Libraries, and Embedded Content 中。
4. 同方案 A 替换插件实现。

## 已实现的接口

### AMapLocationPlugin
- `getCurrentPosition`
- `startWatch` / `stopWatch`
- `forceDestroy`
- `startTracking` / `stopTracking`
- `isTrackingAlive`
- `updateNotificationSteps` (iOS no-op)
- `openAppPermissionSettings`
- `isBatteryOptimizationIgnored` (iOS no-op)
- `openBatteryOptimizationSettings` (iOS no-op)
- `getRomInfo` (iOS no-op)
- `getOfflineLocations` / `acknowledgeLocations` / `hydrateOfflinePoints`（基于 GRDB.swift）

### AudioFocusPlugin
- `requestDucking` — 使用 `AVAudioSession.playback + .duckOthers` 压低背景音乐
- `abandonDucking` — 恢复背景音乐音量
- `isDucking` — 查询当前是否处于 ducking 状态

### 已自动集成的社区插件
- `@capacitor-community/text-to-speech` — iOS 原生使用 `AVSpeechSynthesizer`
- `@capgo/capacitor-pedometer` — iOS 原生使用 `CMPedometer`

## GRDB.swift 依赖维护

Capacitor CLI 执行 `npx cap sync ios` 时会重写 `CapApp-SPM/Package.swift`，导致 GRDB.swift 依赖丢失。
在 macOS 环境中，每次 sync 后请运行：

```powershell
cd ios
.\apply-grdb-to-package-swift.ps1
```

## 待后续验证

- [ ] macOS + Xcode 真机编译通过
- [ ] 接入 AMapLocation SDK 后坐标确为 GCJ-02
- [ ] 后台定位持续采点验证
- [ ] 断网/恢复前台后离线数据库 ACK 机制验证
- [ ] 模拟器/真机 `isMock` 启发式检测验证
