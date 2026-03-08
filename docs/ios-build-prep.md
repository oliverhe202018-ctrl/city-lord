# iOS GitHub Actions 构建前准备指南

本文档记录了使得 `.github/workflows/ios-build.yml` 成功运行所需的本地手工工作及秘钥提取过程。在执行 CI 之前，您必须完成以下所有操作。

## 1. 初始化 iOS 工程并提交

由于当前仓库未包含原生的 iOS 工程，需执行以下步骤：
```bash
npx cap add ios
npx cap sync ios
npx cap open ios
```
进入 Xcode 后，按下方步骤 2-3 处理 Signing 并在 "Signing & Capabilities" 中添加相应的能力（如 Background Modes、Push Notifications）。
完成后，**务必把生成的 `ios/` 目录提交并 Push 到代码仓库所在的 main 分支。**

## 2. Certificates (证书) 导出方法

自动构建需要您的 Apple Distribution（发版）或 Apple Development（开发）证书的 `.p12` 格式及密码。

1. 打开受信任的 Mac 电脑上的 **Keychain Access (钥匙串访问)**。
2. 左上角选择 **Login (登录)**，左下角分类选择 **Certificates (证书)**。
3. 找到您的证书（如 `"Apple Distribution: Your Name (YOUR_TEAM_ID)"`），展开找到对应私钥。
4. **同时选中**证书和私钥，右键 -> **Export 2 items...**
5. 格式选择 **Personal Information Exchange (.p12)**，命名如 `ios_distribution.p12`。
6. 设置一个导出密码（此即下方的 `APPLE_CERT_PASSWORD`），点击保存。
7. 在终端运行以下命令将其转换为无回车的 Base64 字符串：
   ```bash
   base64 -i ios_distribution.p12 | tr -d '\n' | pbcopy
   ```
   *(执行结束后 Base64 已复制到了您的剪贴板，请粘贴至 GitHub Secrets，即 `APPLE_CERT_BASE64`)*。

## 3. Provisioning Profile 获取方式

Profile 是捆绑证书、Bundle ID 与设备（如系 Ad-Hoc）的文件。

1. 登录 [Apple Developer Portal](https://developer.apple.com/account)。
2. 进入 -> **Profiles**。
3. 点击 **+** 创建一个新的 Profile (Distribution -> App Store Connect 或 Ad-Hoc)。
4. 绑定您的 App ID (`com.citylord.game.pro`) 及证书。
5. 生成并下载该 Profile (例如命名为 `CityLordDist.mobileprovision`)。
6. 同理，使用命令行将其转换为 Base64：
   ```bash
   base64 -i CityLordDist.mobileprovision | tr -d '\n' | pbcopy
   ```
   *(剪贴板内容作为 `APPLE_MOBILEPROVISION_BASE64` 填入 GitHub)*。

## 4. GitHub Secrets 清单与录入

前往代码仓库主页 -> **Settings** -> **Secrets and variables** -> **Actions** -> **New repository secret**，依次录入：

| 变量名 | 说明 |
| :--- | :--- |
| `APPLE_TEAM_ID` | 您的开发者团队 ID，如 `ABC123XYZ9` (明文) |
| `APPLE_CERT_BASE64` | `ios_distribution.p12` 的 Base64 字符串 |
| `APPLE_CERT_PASSWORD` | 导出 `.p12` 证书时设定的密码 |
| `APPLE_MOBILEPROVISION_BASE64` | `.mobileprovision` 文件的 Base64 字符串 |
| `KEYCHAIN_PASSWORD` | CI 构建期间注入 Keychain 的密码，由您随意设置一个短句即可 |

> **提示**：如果有特定的 ExportOptions（例如：`ad-hoc` 还是 `app-store`），请同步修改仓库中 `scripts/ios/ExportOptions.template.plist` 内的选项。

## 5. 常见构建失败排查 (Troubleshooting)

- **证书或 Profile 导入失败**：绝大多数是因为使用了含换行符的 Base64 文本。务必在终端里带上 `tr -d '\n'`。
- **No profile for team Error**：GitHub Workflow 中 `xcodebuild -exportArchive` 报此错，表明 Profile 不支持所配置的团队、不存在该 Bundle ID、或者 `ExportOptions.plist` 写错了 Profile 的实体名。
- **Provisioning Profile 不匹配 Code Sign Identity**：常见于证书为 "Apple Development" 但导出的 Profile 选了 Distribution，两权需匹配。
- **Pod install 阶段报错**：通常因为 Node 依赖 (Capacitor Plugins) 中原生 SDK 不兼容该 Runner 的 Xcode 版本或 Podfile 配置异常。可审查 `npx cap sync ios` 的终端输出日志。
