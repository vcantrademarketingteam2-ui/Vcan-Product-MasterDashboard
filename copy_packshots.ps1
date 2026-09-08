# VCAN Dashboard - Copy Packshots to public/packshots/
# Called by update_dashboard.bat (with -NoPause) or run directly.
param([switch]$NoPause)

$src = "Y:\MARKETING\Meth\ห้องทำงาน Claude\Product Packshot for dashboard"
$dst = Join-Path $PSScriptRoot "public\packshots"

function Wait-IfInteractive {
    if (-not $NoPause -and [Environment]::UserInteractive) {
        try { Read-Host "Press Enter to continue..." | Out-Null } catch {}
    }
}

if (-not (Test-Path $src)) {
    Write-Host "[ERROR] Source folder not found: $src" -ForegroundColor Red
    Write-Host "        Reconnect the Y: network drive and run again." -ForegroundColor Red
    Wait-IfInteractive
    exit 1
}

New-Item -ItemType Directory -Force -Path $dst | Out-Null
Write-Host "[1/2] Scanning images in Y: drive..."

$copied = 0; $errors = 0
$skippedNames = New-Object System.Collections.Generic.List[string]
$exts = @('.jpg','.jpeg','.png','.webp')

# Variants that are NOT the plain product shot - regulatory label scans, duplicates.
$excludeRe = 'รวมสคบด้านหลัง|สคบ|ฉลาก|(?i)\b(dup|copy|duplicate)\b|(?i)_dup'

Get-ChildItem $src -Recurse -File | Where-Object { $exts -contains $_.Extension.ToLower() } | ForEach-Object {
    $file = $_
    $name = $file.BaseName
    $ext  = $file.Extension.ToLower()

    # Barcode must lead the filename; anything after it may describe the shot.
    if ($name -notmatch '^\s*(\d{8,})\b(.*)$') {
        $skippedNames.Add("$($file.Name)  (no leading barcode)"); return
    }
    $barcode = $Matches[1]
    $rest    = $Matches[2]

    if ($rest -match $excludeRe) {
        $skippedNames.Add("$($file.Name)  (label / duplicate variant)"); return
    }

    if     ($rest -match '(?i)\bback\b')  { $side = 'back'  }
    elseif ($rest -match '(?i)\bfront\b') { $side = 'front' }
    elseif ($rest.Trim() -eq '')          { $side = 'front' }
    else {
        $skippedNames.Add("$($file.Name)  (no Front/Back in name)"); return
    }

    $target = Join-Path $dst "${barcode}_${side}${ext}"
    if ((-not (Test-Path $target)) -or ($file.LastWriteTime -gt (Get-Item $target).LastWriteTime)) {
        try { Copy-Item $file.FullName $target -Force; $copied++ }
        catch {
            Write-Host "  ERROR copying $($file.Name): $($_.Exception.Message)" -ForegroundColor Yellow
            $errors++
        }
    }
}

Write-Host "[2/2] Done!" -ForegroundColor Green
Write-Host "  Copied  : $copied files"
Write-Host "  Skipped : $($skippedNames.Count) files"
Write-Host "  Errors  : $errors files"

if ($skippedNames.Count -gt 0) {
    Write-Host ""
    Write-Host "  Skipped files (rename to '<barcode> Front.jpg' / '<barcode> Back.jpg' to include them):" -ForegroundColor Yellow
    $skippedNames | Sort-Object | ForEach-Object { Write-Host "    - $_" -ForegroundColor DarkYellow }
}

Wait-IfInteractive
if ($errors -gt 0) { exit 1 }
exit 0
