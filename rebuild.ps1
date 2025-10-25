# Rebuild Script
Write-Host "Rebuilding..." -ForegroundColor Cyan

# Kill processes
Get-Process | Where-Object {$_.Name -like "*exhentai*"} | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Build
yarn build

if ($LASTEXITCODE -eq 0) {
    Write-Host "Build OK" -ForegroundColor Green
    Write-Host "Now test in dev mode: yarn start" -ForegroundColor Yellow
} else {
    Write-Host "Build failed" -ForegroundColor Red
}

