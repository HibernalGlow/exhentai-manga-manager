# Kill all possible processes and rebuild
Write-Host "Force killing processes..." -ForegroundColor Yellow

# Kill Electron processes
Get-Process | Where-Object {$_.ProcessName -like "*electron*" -or $_.ProcessName -like "*exhentai*"} | Stop-Process -Force -ErrorAction SilentlyContinue

Start-Sleep -Seconds 3

# Try to unlock and delete out directory
Write-Host "Removing out directory..." -ForegroundColor Yellow
if (Test-Path ".\out") {
    # Try multiple times
    for ($i = 1; $i -le 3; $i++) {
        try {
            Remove-Item ".\out" -Recurse -Force -ErrorAction Stop
            Write-Host "Deleted successfully" -ForegroundColor Green
            break
        } catch {
            Write-Host "Attempt $i failed, retrying..." -ForegroundColor Yellow
            Start-Sleep -Seconds 2
        }
    }
}

# If still exists, try robocopy trick to clear it
if (Test-Path ".\out") {
    Write-Host "Using alternative deletion method..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path ".\empty_temp" -Force | Out-Null
    robocopy ".\empty_temp" ".\out" /MIR /R:0 /W:0 2>&1 | Out-Null
    Remove-Item ".\empty_temp" -Force -Recurse -ErrorAction SilentlyContinue
    Remove-Item ".\out" -Force -Recurse -ErrorAction SilentlyContinue
}

Start-Sleep -Seconds 2

# Now rebuild
Write-Host ""
Write-Host "Building..." -ForegroundColor Cyan
yarn build

Write-Host ""
Write-Host "Packaging..." -ForegroundColor Cyan
$env:npm_config_build_from_source = "false"
yarn dist

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "SUCCESS!" -ForegroundColor Green
    Write-Host "Starting app..." -ForegroundColor Yellow
    Start-Process ".\out\win-unpacked\exhentai-manga-manager.exe"
} else {
    Write-Host ""
    Write-Host "FAILED!" -ForegroundColor Red
}

