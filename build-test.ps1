# Build Test Script
Write-Host "Starting build test..." -ForegroundColor Cyan

# Close running instances
Write-Host "Checking for running instances..." -ForegroundColor Yellow
$proc = Get-Process -Name "exhentai-manga-manager" -ErrorAction SilentlyContinue
if ($proc) {
    Write-Host "Closing running instances..." -ForegroundColor Yellow
    $proc | Stop-Process -Force
    Start-Sleep -Seconds 2
}

# Create secret_key.json if needed
if (-not (Test-Path "secret_key.json")) {
    Copy-Item "secret_key.json.template" "secret_key.json"
}

# Clean old builds
Write-Host "Cleaning old builds..." -ForegroundColor Yellow
Remove-Item "dist" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "out" -Recurse -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
yarn install --frozen-lockfile
if ($LASTEXITCODE -ne 0) { exit 1 }

# Build frontend
Write-Host "Building frontend..." -ForegroundColor Yellow
yarn build
if ($LASTEXITCODE -ne 0) { exit 1 }

# Build Electron app
Write-Host "Building Electron app..." -ForegroundColor Yellow
$env:npm_config_build_from_source = "false"
yarn dist
if ($LASTEXITCODE -ne 0) { 
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1 
}

# Check result
$buildDir = Get-ChildItem -Path "out" -Directory -Filter "win-unpacked" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if ($buildDir) {
    $exePath = Join-Path $buildDir.FullName "exhentai-manga-manager.exe"
    if (Test-Path $exePath) {
        Write-Host ""
        Write-Host "Build SUCCESS!" -ForegroundColor Green
        Write-Host "Location: $($buildDir.FullName)" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Starting app..." -ForegroundColor Yellow
        Start-Process $exePath
        Start-Sleep -Seconds 2
        Write-Host ""
        Write-Host "Test checklist:" -ForegroundColor Yellow
        Write-Host "  1. App starts without errors" -ForegroundColor White
        Write-Host "  2. Open Settings -> Check if loads (load-setting IPC)" -ForegroundColor White
        Write-Host "  3. Open AI Config -> Check if loads (get-api-config IPC)" -ForegroundColor White
        Write-Host ""
        $logPath = Join-Path $buildDir.FullName "portable\log.txt"
        Write-Host "Check log file: $logPath" -ForegroundColor Cyan
    }
} else {
    Write-Host "Build directory not found!" -ForegroundColor Red
    exit 1
}

