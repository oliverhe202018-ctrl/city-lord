@echo off
setlocal
cd /d "%~dp0"

echo =========================================
echo City Lord App Builder
echo =========================================
echo 1. Build Local Test APK (Connects to http://10.0.2.2:3000)
echo 2. Build Phone Test APK (Native bundled dist, hits remote API)
echo =========================================
set /p choice="Enter choice (1 or 2): "

if "%choice%"=="1" (
    echo Syncing for Local Test...
    call npm run cap:sync:dev
) else if "%choice%"=="2" (
    echo Building Vite frontend for native bundling...
    call npm run build
    echo Syncing for Production...
    call npm run cap:sync:prod
) else (
    echo Invalid choice.
    exit /b 1
)

echo Building APK...
cd android
call gradlew.bat assembleDebug
cd ..

echo =========================================
echo Build complete!
echo Copying APK...
copy /Y android\app\build\outputs\apk\debug\app-debug.apk city_lord_app.apk
echo The APK is located at: %~dp0city_lord_app.apk
echo =========================================
pause
