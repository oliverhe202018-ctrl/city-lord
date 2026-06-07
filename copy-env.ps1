while ($true) {
    ssh root@180.97.221.225 'test -d /root/city-lord'
    if ($LASTEXITCODE -eq 0) {
        scp d:\project\city-lord\.env.local root@180.97.221.225:/root/city-lord/.env
        break
    }
    Start-Sleep -Seconds 5
}
