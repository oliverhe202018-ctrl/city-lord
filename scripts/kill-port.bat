@echo off
setlocal

:: 检查是否提供了端口号
if "%1"=="" (
    echo 用法: kill-port.bat [端口号]
    echo 示例: kill-port.bat 3000
    exit /b 1
)

set PORT=%1

echo 查找占用端口 %PORT% 的进程...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
    set PID=%%a
)

if not defined PID (
    echo 未找到占用端口 %PORT% 的进程
    exit /b 0
)

echo 找到进程 PID: %PID%
tasklist /fi "PID eq %PID%" /fo table

set /p confirm=确认要结束此进程吗? (y/n): 
if /i "%confirm%"=="y" (
    taskkill /F /PID %PID%
    echo 进程已结束
) else (
    echo 操作已取消
)

endlocal
