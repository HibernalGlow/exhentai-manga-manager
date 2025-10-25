# Build and Test Script
Write-Host "=== Build and Test ===" -ForegroundColor Cyan

# 1. Kill running processes
Write-Host "Stopping running instances..." -ForegroundColor Yellow
Get-Process | Where-Object {$_.ProcessName -like "*electron*" -or $_.ProcessName -like "*exhentai*"} | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# 2. Clean old builds
Write-Host "Cleaning old builds..." -ForegroundColor Yellow
Remove-Item "dist" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "out" -Recurse -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# 3. Ensure secret_key.json exists
if (-not (Test-Path "secret_key.json")) {
    Copy-Item "secret_key.json.template" "secret_key.json"
    Write-Host "Created secret_key.json" -ForegroundColor Green
}

# 4. Install dependencies
Write-Host "`nInstalling dependencies..." -ForegroundColor Yellow
yarn install --frozen-lockfile
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to install dependencies!" -ForegroundColor Red
    exit 1
}

# 5. Build frontend
Write-Host "`nBuilding frontend..." -ForegroundColor Yellow
yarn build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Frontend build failed!" -ForegroundColor Red
    exit 1
}

# 6. Build Electron
Write-Host "`nBuilding Electron app..." -ForegroundColor Yellow
$env:npm_config_build_from_source = "false"
yarn dist
if ($LASTEXITCODE -ne 0) {
    Write-Host "Electron build failed!" -ForegroundColor Red
    exit 1
}

# 7. Verify build
Write-Host "`n=== Verification ===" -ForegroundColor Cyan
$exePath = ".\out\win-unpacked\exhentai-manga-manager.exe"
$modulesPath = ".\out\win-unpacked\resources\app.asar.unpacked\modules\ipc_handlers\all_handlers.js"

if (Test-Path $exePath) {
    Write-Host "[OK] Main executable exists" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Main executable not found" -ForegroundColor Red
    exit 1
}

if (Test-Path $modulesPath) {
    Write-Host "[OK] Modules correctly unpacked" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Modules not unpacked" -ForegroundColor Red
    exit 1
}

# 8. Start app
Write-Host "`n=== Starting Application ===" -ForegroundColor Cyan
Start-Process $exePath
Start-Sleep -Seconds 3

Write-Host "`n=== Test Checklist ===" -ForegroundColor Yellow
Write-Host "1. App starts without errors (no 'No handler registered')" -ForegroundColor White
Write-Host "2. Open Settings page -> loads normally" -ForegroundColor White
Write-Host "3. Open AI Config -> loads normally" -ForegroundColor White
Write-Host "4. Check console (F12) -> no IPC errors" -ForegroundColor White
Write-Host "5. Test import SQLite with default path" -ForegroundColor White
Write-Host "`nLog file: .\out\win-unpacked\portable\log.txt" -ForegroundColor Cyan



