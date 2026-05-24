[Reflection.Assembly]::LoadWithPartialName('System.Drawing') | Out-Null
$bmp = New-Object System.Drawing.Bitmap('C:\Users\a2515\.gemini\antigravity\brain\a863c525-1172-448b-89d5-4fc015c6fee8\screencap.png')

Write-Output "Image size: Width=$($bmp.Width), Height=$($bmp.Height)"

# Let's inspect the vertical line around X = 910 to 1050
# We want to find circles of white color (e.g. R,G,B all > 240)
# and count their vertical positions.

$whiteY = @()
for ($y = 400; $y -lt $bmp.Height - 400; $y++) {
    # check at X = 910 (which should pass through the center of the right buttons)
    $c = $bmp.GetPixel(910, $y)
    if ($c.R -ge 240 -and $c.G -ge 240 -and $c.B -ge 240) {
        $whiteY += $y
    }
}

# Group contiguous Y segments
if ($whiteY.Length -gt 0) {
    $segments = @()
    $currentStart = $whiteY[0]
    $currentLast = $whiteY[0]
    
    for ($i = 1; $i -lt $whiteY.Length; $i++) {
        if ($whiteY[$i] -eq $currentLast + 1) {
            $currentLast = $whiteY[$i]
        } else {
            $segments += [PSCustomObject]@{ Start = $currentStart; End = $currentLast; Center = [Math]::Round(($currentStart + $currentLast)/2) }
            $currentStart = $whiteY[$i]
            $currentLast = $whiteY[$i]
        }
    }
    $segments += [PSCustomObject]@{ Start = $currentStart; End = $currentLast; Center = [Math]::Round(($currentStart + $currentLast)/2) }
    
    Write-Output "Found white segments at X=910:"
    $segments | Out-String | Write-Output
} else {
    Write-Output "No white pixels found at X=910"
}
