@echo off
set ANDROID_HOME=C:\Users\a2515\AppData\Local\Android\Sdk
echo y | "%ANDROID_HOME%\cmdline-tools\latest\bin\sdkmanager.bat" --uninstall "build-tools;35.0.0"
echo y | "%ANDROID_HOME%\cmdline-tools\latest\bin\sdkmanager.bat" "build-tools;34.0.0"
