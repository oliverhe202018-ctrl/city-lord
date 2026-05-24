[Reflection.Assembly]::LoadWithPartialName('System.Drawing') | Out-Null
$bmp = New-Object System.Drawing.Bitmap('C:\Users\a2515\.gemini\antigravity\brain\a863c525-1172-448b-89d5-4fc015c6fee8\screencap.png')

# Find connected components of white pixels in the right part of the screen (X > 800)
# White is defined as R > 230, G > 230, B > 230
$visited = New-Object 'System.Boolean[,]' $bmp.Width, $bmp.Height

$components = @()

for ($x = 850; $x -lt $bmp.Width; $x++) {
    for ($y = 500; $y -lt 2000; $y++) {
        $c = $bmp.GetPixel($x, $y)
        if ($c.R -ge 230 -and $c.G -ge 230 -and $c.B -ge 230 -and -not $visited[$x, $y]) {
            # Start flood fill
            $minX = $x
            $maxX = $x
            $minY = $y
            $maxY = $y
            
            $queue = New-Object System.Collections.Queue
            $queue.Enqueue(@($x, $y))
            $visited[$x, $y] = $true
            $pixelCount = 0
            
            while ($queue.Count -gt 0) {
                $pos = $queue.Dequeue()
                $px = $pos[0]
                $py = $pos[1]
                $pixelCount++
                
                if ($px -lt $minX) { $minX = $px }
                if ($px -gt $maxX) { $maxX = $px }
                if ($py -lt $minY) { $minY = $py }
                if ($py -gt $maxY) { $maxY = $py }
                
                # Check 4 neighbors
                $neighbors = @(
                    @($px-1, $py), @($px+1, $py), @($px, $py-1), @($px, $py+1)
                )
                foreach ($n in $neighbors) {
                    $nx = $n[0]
                    $ny = $n[1]
                    if ($nx -ge 850 -and $nx -lt $bmp.Width -and $ny -ge 500 -and $ny -lt 2000) {
                        if (-not $visited[$nx, $ny]) {
                            $nc = $bmp.GetPixel($nx, $ny)
                            if ($nc.R -ge 230 -and $nc.G -ge 230 -and $nc.B -ge 230) {
                                $visited[$nx, $ny] = $true
                                $queue.Enqueue(@($nx, $ny))
                            }
                        }
                    }
                }
            }
            
            $w = $maxX - $minX + 1
            $h = $maxY - $minY + 1
            # We are looking for circles with diameter around 90-120 pixels
            if ($w -ge 80 -and $w -le 140 -and $h -ge 80 -and $h -le 140) {
                $centerX = [Math]::Round(($minX + $maxX)/2)
                $centerY = [Math]::Round(($minY + $maxY)/2)
                $components += [PSCustomObject]@{
                    CenterX = $centerX
                    CenterY = $centerY
                    Width = $w
                    Height = $h
                    Pixels = $pixelCount
                }
            }
        }
    }
}

Write-Output "Found circular white buttons:"
$components | Out-String | Write-Output
