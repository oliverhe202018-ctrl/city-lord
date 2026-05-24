[Reflection.Assembly]::LoadWithPartialName('System.Drawing') | Out-Null
$bmp = New-Object System.Drawing.Bitmap('C:\Users\a2515\.gemini\antigravity\brain\a863c525-1172-448b-89d5-4fc015c6fee8\screencap.png')
$minY = 9999
$maxY = -1
for ($y = 2100; $y -lt 2350; $y++) {
    $c = $bmp.GetPixel(270, $y)
    if ($c.R -gt 200 -and $c.G -lt 100 -and $c.B -lt 100) {
        if ($y -lt $minY) { $minY = $y }
        if ($y -gt $maxY) { $maxY = $y }
    }
}
Write-Output "Red button Y range: $minY to $maxY"
