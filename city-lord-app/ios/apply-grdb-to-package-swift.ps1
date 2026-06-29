# 由于 Capacitor CLI 会在 npx cap sync ios 时重写 Package.swift，
# 此脚本用于在 sync 后自动恢复 GRDB.swift 依赖。
# 使用方法：npx cap sync ios; .\apply-grdb-to-package-swift.ps1

$packageSwift = "App\CapApp-SPM\Package.swift"

if (-not (Test-Path $packageSwift)) {
    Write-Error "Package.swift not found at $packageSwift. Run this script from the ios directory."
    exit 1
}

$content = Get-Content $packageSwift -Raw

# 1. 确保 dependencies 中包含 GRDB
if ($content -notmatch 'https://github.com/groue/GRDB.swift.git') {
    $content = $content -replace '(.package\(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "[\d.]+"\),)', "$1`n        .package(url: `"https://github.com/groue/GRDB.swift.git`", from: `"6.29.0`"),"
    Write-Host "Added GRDB.swift dependency."
}

# 2. 确保 target dependencies 中包含 GRDB
if ($content -notmatch 'product\(name: "GRDB", package: "GRDB.swift"\)') {
    $content = $content -replace '(\.product\(name: "CapacitorNativeSettings", package: "CapacitorNativeSettings"\))', "$1,`n                .product(name: `"GRDB`", package: `"GRDB.swift`")"
    Write-Host "Added GRDB product to target dependencies."
}

Set-Content -Path $packageSwift -Value $content -NoNewline
Write-Host "CapApp-SPM/Package.swift GRDB dependency restored."
