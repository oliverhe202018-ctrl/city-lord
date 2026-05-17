# City Lord 移动端隐私合规核对清单

本清单为您在全量发布至 App Store 和 Google Play 前的自检指南，确保代码行为与线上文档口径一致。

## 1. 权限文案与系统说明一致性核对

请核实工程配置文件中的文案与应用内真实行为完全一致。

### iOS (`ios/App/App/Info.plist`)
- [ ] `NSLocationWhenInUseUsageDescription`: 需要准确告知用户“我们需要该权限为您在地图上展示实时位置并在您开始跑步时记录行进轨迹”。
- [ ] `NSLocationAlwaysAndWhenInUseUsageDescription`: 非常关键！需要明确表述“即使应用退至后台或锁屏状态，为保证跑步计算的完整性，仍需持续追踪您的精确轨迹”。
- [ ] `NSMicrophoneUsageDescription`: 表述为“向好友发起语音消息私聊”。
- [ ] `NSHealthShareUsageDescription` & `NSHealthUpdateUsageDescription` (如有调用 HealthKit): 解释请求同步运动计步数据的目的。

### Android (`android/app/src/main/AndroidManifest.xml`)
- [ ] `<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />`：前台精确定位。
- [ ] `<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />`：后台定位。
- [ ] `<uses-permission android:name="android.permission.RECORD_AUDIO" />`：请求麦克风录音。
*(注意：只要包含上列敏感权限，均需在代码中先通过 UI 弹窗向用户进行 Prominent Disclosure【重要提示】)*

## 2. App 内隐私入口自检

开发阶段完毕后的代码审查必须确认以下交互闭环存在且通畅：
- [ ] **启动/登录阻拦**：不论使用密码还是验证码登录，用户在未勾选并同意《用户协议》和《隐私政策》前，都无法通过任何手段登入应用 (已在此次重构中于 `login/page.tsx` 实现)。
- [ ] **常态化阅读入口**：在用户登录后，“设置/Profile”中随时可以跳转查看两项政策全文。
- [ ] **删除一切数据权**：“我的 -> 设置 -> 注销账号”操作逻辑不可逆地提交数据删除要求。目前实现为 Toast 告知提交，满足合规所需的“具备提交入口”要件，不虚构“立刻瞬间全网级联删除”而导致客诉风险。
- [ ] **二次后台授权拦击**：用户尝试点击“Start Run”前，若从未使用过该功能，系统通过自定义的 Dialog 显式弹出原因向其说明，取得首肯后调用 Capacitor 请求 `BackgroundGeolocation` 授权。

## 3. Apple App Privacy 与 Privacy Manifest 核对

针对苹果后台提交 App Privacy：
- [ ] **Location (位置)** -> Precise Location (精准位置) -> App Functionality (产品功能) -> 不能用于跟踪。
- [ ] **Contact Info (联系信息)** -> Email / Phone number (手机/电邮) -> Account Management (账号管理)。
- [ ] **User Content (用户内容)** -> Audio Data (语音消息) & Messages (其他应用内消息) -> App Functionality。
- [ ] **Identifiers (标识符)** -> 推送 Token (若集成 PushNotification)。
- [ ] **Privacy Manifest (`PrivacyInfo.xcprivacy`)**: 确认是否加入了针对被 Capacitor/Storage 插件调用的 File Timestamp 或 UserDefaults 的必报项 (若您使用 XCode 15.0+)。

## 4. Google Play Data Safety 表单核对

针对 Google Play Console 提交数据安全表单：
- [ ] 申报收集：`Location` (精确定位)、`Personal info` (电邮/手机)、`Audio` (语音记录)。
- [ ] 是传输加密：`Yes, encrypted in transit`。
- [ ] 用户可以申请删除数据：`Yes, can request deletion`。
- [ ] 共享申报情况：**务必选 NO (不共享) **。因为应用内虽利用了推送 SDK 与 Sentry 收集服务，但这些从属于应用的必需组件运维范畴，非营销广告分享行为，依此能避免严苛的广告商户声明。
