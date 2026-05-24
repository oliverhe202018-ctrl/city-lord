[Reflection.Assembly]::LoadWithPartialName('System.Drawing') | Out-Null
$bmp = New-Object System.Drawing.Bitmap('C:\Users\a2515\.gemini\antigravity\brain\a863c525-1172-448b-89d5-4fc015c6fee8\screencap.png')

$minX = 9999
$maxX = -1
$minY = 9999
$maxY = -1

for ($x = 800; $x -lt 1080; $x++) {
    for ($y = 0; $y -lt $bmp.Height; $y++) {
        $c = $bmp.GetPixel($x, $y)
        # Amber/Orange color signature: R in [200, 255], G in [120, 190], B in [20, 90]
        if ($c.R -ge 200 -and $c.R -le 255 -and $c.G -ge 120 -and $c.G -le 190 -and $c.B -ge 20 -and $c.B -le 90) {
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}

if ($maxX -ne -1) {
    $centerX = [Math]::Round(($minX + $maxX) / 2)
    $centerY = [Math]::Round(($minY + $maxY) / 2)
    Write-Output "Orange Bounding Box: X=[$minX, $maxX], Y=[$minY, $maxY]"
    Write-Output "Orange Button Center: X=$centerX, Y=$centerY"
} else {
    Write-Output "Orange pixels not found"
}
