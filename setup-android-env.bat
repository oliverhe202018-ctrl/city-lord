@echo off
echo ========================================
echo Android SDK 环境配置脚本
echo ========================================
echo.

REM 设置环境变量
set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
set PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\cmdline-tools\latest\bin;%PATH%

echo Step 1: 检查 Java 安装...
java -version
if errorlevel 1 (
    echo [错误] Java 未正确安装，请检查 JAVA_HOME
    pause
    exit /b 1
)
echo.

echo Step 2: 创建许可证目录...
if not exist "%ANDROID_HOME%\licenses" mkdir "%ANDROID_HOME%\licenses"

echo Step 3: 接受 Android SDK 许可证...
echo 8933bad161af4178b1185d1a37fbf41ea5269c55 > "%ANDROID_HOME%\licenses\android-sdk-license"
echo d56f5187479451cabf44308902d2b7d6e5c31a07 >> "%ANDROID_HOME%\licenses\android-sdk-license"
echo 84831b9409646a918e30573bab4c9c91346d8abd > "%ANDROID_HOME%\licenses\android-sdk-preview-license"
echo.

echo Step 4: 安装 Android SDK 组件...
echo 这可能需要几分钟时间，请耐心等待...
echo.
sdkmanager --sdk_root="%ANDROID_HOME%" --no_https "platforms;android-35" "build-tools;35.0.0" "platform-tools" "cmdline-tools;latest"
echo.

echo Step 5: 验证安装...
echo 已安装的组件：
sdkmanager --sdk_root="%ANDROID_HOME%" --list_installed
echo.

echo ========================================
echo 环境配置完成！
echo ========================================
echo.
echo 现在你可以：
echo 1. 重启 Trae IDE 终端
echo 2. 运行 sdkmanager --licenses 验证许可证
echo 3. 开始构建 APK
echo.
pause
