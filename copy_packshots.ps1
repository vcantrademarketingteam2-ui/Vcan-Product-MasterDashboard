
# ============================================================
#  VCAN Dashboard — Copy Packshots to public/packshots/
#  Run this whenever Y: drive images are updated
#  Usage: Right-click → Run with PowerShell
# ============================================================

$src = "Y:\MARKETING\Meth\ห้องทำงาน Claude\Product Packshot for dashboard"
$dst = "c:\Users\V-Can Nantawan\vcan-dashboard\public\packshots"

if (-not (Test-Path $src)) {
    Write-Host "[ERROR] Source folder not found: $src" -ForegroundColor Red
    pause; exit
}

New-Item -ItemType Directory -Force -Path $dst | Out-Null
Write-Host "[1/2] Scanning images in Y: drive..."

$copied = 0; $skipped = 0
$exts   = @('.jpg','.jpeg','.png','.webp')

Get-ChildItem $src -Recurse -File | Where-Object { $exts -contains $_.Extension.ToLower() } | ForEach-Object {
    $name = $_.BaseName   # filename without extension
    $ext  = $_.Extension.ToLower()

    # Pattern 1: "{barcode} Front", "{barcode} Back", "{barcode} (Front)", "{barcode} (Back)"
    if ($name -match '^(\d{8,})\s+\(?(Front|Back)\)?$') {
        $barcode = $Matches[1]
        $side    = $Matches[2].ToLower()
    }
    # Pattern 2: "{barcode}" only (treat as front)
    elseif ($name -match '^(\d{8,})$') {
        $barcode = $Matches[1]
        $side    = 'front'
    }
    else {
        $skipped++; return
    }

    $target = "$dst\${barcode}_${side}${ext}"
    # Only copy if newer or doesn't exist
    if (-not (Test-Path $target) -or ($_.LastWriteTime -gt (Get-Item $target).LastWriteTime)) {
        Copy-Item $_.FullName $target -Force
        $copied++
    }
}

Write-Host "[2/2] Done!" -ForegroundColor Green
Write-Host "  Copied/updated : $copied files"
Write-Host "  Skipped (no barcode in name): $skipped files"
Write-Host ""
Write-Host "Packshots available at: $dst"
Write-Host "Refresh the dashboard to see changes."
pause
