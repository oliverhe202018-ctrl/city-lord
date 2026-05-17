param(
    [Parameter(Mandatory=$true)]
    [int]$Port
)

Write-Host "查找占用端口 $Port 的进程..." -ForegroundColor Yellow

try {
    $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' }

    if (-not $connections) {
        Write-Host "未找到占用端口 $Port 的进程" -ForegroundColor Green
        exit 0
    }

    $pid = $connections[0].OwningProcess
    $process = Get-Process -Id $pid -ErrorAction SilentlyContinue

    if ($process) {
        Write-Host "找到进程:" -ForegroundColor Yellow
        Write-Host "  PID: $($process.Id)" -ForegroundColor White
        Write-Host "  名称: $($process.ProcessName)" -ForegroundColor White
        Write-Host "  路径: $($process.Path)" -ForegroundColor White

        $confirm = Read-Host "确认要结束此进程吗? (y/n)"
        if ($confirm -eq 'y' -or $confirm -eq 'Y') {
            Stop-Process -Id $pid -Force
            Write-Host "进程已结束" -ForegroundColor Green
        } else {
            Write-Host "操作已取消" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "错误: $_" -ForegroundColor Red
    exit 1
}
