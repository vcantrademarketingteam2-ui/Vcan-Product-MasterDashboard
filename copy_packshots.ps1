# VCAN Dashboard - Copy Packshots to public/packshots/
# Called by update_dashboard.bat (NonInteractive) or run directly

$src = "Y:\MARKETING\Meth\ห้องทำงาน Claude\Product Packshot for dashboard"
$dst = "c:\Users\V-Can Nantawan\vcan-dashboard\public\packshots"
$isInteractive = [Environment]::UserInteractive -and (-not $args -contains "-NonInteractive")

if (-not (Test-Path $src)) {
    Write-Host "[ERROR] Source folder not found: $src" -ForegroundColor Red
    try { if ($isInteractive) { Read-Host "Press Enter to continue..." } } catch {}
    exit 1
}

New-Item -ItemType Directory -Force -Path $dst | Out-Null
Write-Host "[1/2] Scanning images in Y: drive..."

$copied = 0; $skipped = 0; $errors = 0
$exts = @('.jpg','.jpeg','.png','.webp')

Get-ChildItem $src -Recurse -File | Where-Object { $exts -contains $_.Extension.ToLower() } | ForEach-Object {
    $name = $_.BaseName
    $ext  = $_.Extension.ToLower()
    if ($name -match '^(\d{8,})\s+\(?(Front|Back)\)?$') {
        $barcode = $Matches[1]; $side = $Matches[2].ToLower()
    } elseif ($name -match '^(\d{8,})$') {
        $barcode = $Matches[1]; $side = 'front'
    } else {
        $skipped++; return
    }
    $target = "$dst\${barcode}_${side}${ext}"
    if (-not (Test-Path $target) -or ($_.LastWriteTime -gt (Get-Item $target).LastWriteTime)) {
        try { Copy-Item $_.FullName $target -Force; $copied++ }
        catch { Write-Host "  ERROR: $($_.Name)" -ForegroundColor Yellow; $errors++ }
    }
}

Write-Host "[2/2] Done!" -ForegroundColor Green
Write-Host "  Copied  : $copied files"
Write-Host "  Skipped : $skipped files (no barcode in name)"
Write-Host "  Errors  : $errors files"
try { if ($isInteractive) { Read-Host "Press Enter to continue..." } } catch {}