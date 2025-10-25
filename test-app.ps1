# Test app startup
$exePath = ".\out\win-unpacked\exhentai-manga-manager.exe"

Write-Host "Starting app with console output..." -ForegroundColor Yellow
Start-Process $exePath -Wait -NoNewWindow

Write-Host "App exited. Checking for portable directory..." -ForegroundColor Yellow
if (Test-Path ".\out\win-unpacked\portable") {
    Write-Host "Portable directory exists!" -ForegroundColor Green
    if (Test-Path ".\out\win-unpacked\portable\log.txt") {
        Write-Host "Log file content:" -ForegroundColor Cyan
        Get-Content ".\out\win-unpacked\portable\log.txt"
    }
} else {
    Write-Host "Portable directory does NOT exist!" -ForegroundColor Red
}

