# 端口管理脚本

当你遇到端口被占用的问题时，可以使用这些脚本快速解决。

## 使用方法

### Windows 批处理脚本 (推荐)

```bash
# 结束占用 3000 端口的进程
scripts\kill-port.bat 3000

# 结束占用 3001 端口的进程
scripts\kill-port.bat 3001
```

### PowerShell 脚本

```powershell
# 结束占用 3000 端口的进程
.\scripts\Kill-Port.ps1 -Port 3000

# 结束占用 3001 端口的进程
.\scripts\Kill-Port.ps1 -Port 3001
```

## 使用场景

- 当你看到 `http://localhost:3000/` 打不开
- 当启动开发服务器时报错 "Port 3000 is already in use"
- 当你需要快速重启服务器但端口被占用

## 注意事项

- 脚本会显示被结束的进程信息
- 在结束进程前会要求确认
- 请确保你结束的是正确的进程
- 如果不确定，可以手动查看 `netstat -ano | findstr ":3000"`

## 快速命令

查看端口占用情况：
```bash
netstat -ano | findstr ":3000"
```

手动结束进程：
```bash
taskkill /F /PID <进程ID>
```
