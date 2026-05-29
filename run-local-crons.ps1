# ==============================================================================
# City Lord Game - Windows Local Cron Emulator Daemon
# ==============================================================================
# This script emulates Linux crontab execution on Windows by running an infinite
# loop. It invokes the Next.js API endpoints at the configured frequencies.
# ==============================================================================

# Configuration
$APP_URL = "http://localhost:3000"
$CRON_SECRET = "aaa021300" # Change this to match your env.local

Write-Host "==============================================================================" -ForegroundColor Green
Write-Host "          City Lord Scheduled Tasks Local Emulator (Windows)" -ForegroundColor Green
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host "ℹ️  Target App URL: $APP_URL" -ForegroundColor Cyan
Write-Host "ℹ️  Press [Ctrl+C] to stop the daemon at any time." -ForegroundColor Yellow

$counter = 0

while ($true) {
    $now = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    
    # 1. territory-stats-worker (Every 1 minute)
    Write-Host "[$now] [1 min] Triggering Stats Worker..." -NoNewline
    try {
        $headers = @{ "Authorization" = "Bearer $CRON_SECRET" }
        $res = Invoke-RestMethod -Uri "$APP_URL/api/cron/territory-stats-worker" -Method Get -Headers $headers -TimeoutSec 10
        Write-Host " SUCCESS (processed: $($res.processed))" -ForegroundColor Green
    } catch {
        Write-Host " FAILED: $($_.Exception.Message)" -ForegroundColor Red
    }

    # 2. stamina-recovery & update-faction-stats (Every 5 minutes)
    if ($counter % 5 -eq 0) {
        Write-Host "[$now] [5 min] Triggering Stamina Recovery..." -NoNewline
        try {
            $res = Invoke-RestMethod -Uri "$APP_URL/api/cron/stamina-recovery" -Method Get -Headers $headers -TimeoutSec 10
            Write-Host " SUCCESS (recovered: $($res.recoveredCount))" -ForegroundColor Green
        } catch {
            Write-Host " FAILED: $($_.Exception.Message)" -ForegroundColor Red
        }

        Write-Host "[$now] [5 min] Triggering Faction Stats Update..." -NoNewline
        try {
            $res = Invoke-RestMethod -Uri "$APP_URL/api/cron/update-faction-stats" -Method Get -Headers $headers -TimeoutSec 10
            Write-Host " SUCCESS" -ForegroundColor Green
        } catch {
            Write-Host " FAILED: $($_.Exception.Message)" -ForegroundColor Red
        }
    }

    # 3. update-province & activity-reminder (Every 60 minutes)
    if ($counter % 60 -eq 0 -and $counter -ne 0) {
        Write-Host "[$now] [60 min] Triggering Province Stats Update..." -NoNewline
        try {
            $res = Invoke-RestMethod -Uri "$APP_URL/api/cron/update-province" -Method Get -Headers $headers -TimeoutSec 15
            Write-Host " SUCCESS (count: $($res.count))" -ForegroundColor Green
        } catch {
            Write-Host " FAILED: $($_.Exception.Message)" -ForegroundColor Red
        }

        Write-Host "[$now] [60 min] Triggering Activity Reminder..." -NoNewline
        try {
            $res = Invoke-RestMethod -Uri "$APP_URL/api/cron/activity-reminder" -Method Get -Headers $headers -TimeoutSec 15
            Write-Host " SUCCESS" -ForegroundColor Green
        } catch {
            Write-Host " FAILED: $($_.Exception.Message)" -ForegroundColor Red
        }
    }

    # 4. npc-invasion (Every 12 hours / 720 minutes)
    if ($counter % 720 -eq 0 -and $counter -ne 0) {
        Write-Host "[$now] [12 hours] Triggering Ghost NPC Invasion..." -NoNewline
        try {
            $res = Invoke-RestMethod -Uri "$APP_URL/api/cron/npc-invasion" -Method Post -Headers $headers -TimeoutSec 30
            Write-Host " SUCCESS (processed: $($res.processed_count))" -ForegroundColor Green
        } catch {
            Write-Host " FAILED: $($_.Exception.Message)" -ForegroundColor Red
        }
    }

    # 5. Daily Settlers (Every 24 hours / 1440 minutes)
    if ($counter % 1440 -eq 0 -and $counter -ne 0) {
        $dailyJobs = @(
            @{ name = "Leaderboard Snapshot"; path = "/api/cron/leaderboard-snapshot" },
            @{ name = "Reset Missions";      path = "/api/cron/reset-missions" },
            @{ name = "Faction Settlement";  path = "/api/cron/faction-settlement" },
            @{ name = "Daily Stats Record";  path = "/api/cron/daily-stats" },
            @{ name = "Territory Decay";     path = "/api/cron/territory-decay-monitor" },
            @{ name = "Territory Reconcile"; path = "/api/cron/territory-reconcile" },
            @{ name = "Cleanup Invitations"; path = "/api/cron/cleanup-invitations" }
        )

        foreach ($job in $dailyJobs) {
            Write-Host "[$now] [Daily] Triggering $($job.name)..." -NoNewline
            try {
                $res = Invoke-RestMethod -Uri ($APP_URL + $job.path) -Method Get -Headers $headers -TimeoutSec 30
                Write-Host " SUCCESS" -ForegroundColor Green
            } catch {
                Write-Host " FAILED: $($_.Exception.Message)" -ForegroundColor Red
            }
        }
    }

    # Sleep for 60 seconds
    Start-Sleep -Seconds 60
    $counter++
}
