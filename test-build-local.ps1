# 本地构建验证脚本
# 在推送到GitHub之前验证构建是否正常

Write-Host "=== Electron构建本地验证脚本 ===" -ForegroundColor Cyan
Write-Host ""

# 1. 清理旧构建
Write-Host "[1/5] 清理旧构建..." -ForegroundColor Yellow
if (Test-Path "out") {
    Remove-Item -Path "out" -Recurse -Force
    Write-Host "  ✓ 已清理 out 目录" -ForegroundColor Green
}
if (Test-Path "dist") {
    Remove-Item -Path "dist" -Recurse -Force
    Write-Host "  ✓ 已清理 dist 目录" -ForegroundColor Green
}

# 2. 确保 secret_key.json 存在
Write-Host "`n[2/5] 检查配置文件..." -ForegroundColor Yellow
if (-not (Test-Path "secret_key.json")) {
    Copy-Item "secret_key.json.template" "secret_key.json"
    Write-Host "  ✓ 已从模板创建 secret_key.json" -ForegroundColor Green
} else {
    Write-Host "  ✓ secret_key.json 已存在" -ForegroundColor Green
}

# 3. 构建前端
Write-Host "`n[3/5] 构建前端..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ 前端构建失败!" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ 前端构建成功" -ForegroundColor Green

# 4. 打包 Electron
Write-Host "`n[4/5] 打包 Electron..." -ForegroundColor Yellow
$env:NODE_ENV = "production"
npx electron-builder --dir
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Electron 打包失败!" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Electron 打包成功" -ForegroundColor Green

# 5. 创建便携版 ZIP
Write-Host "`n[5/5] 创建便携版 ZIP..." -ForegroundColor Yellow
$version = (Get-Content package.json | ConvertFrom-Json).version
$packageName = "exhentai-manga-manager-$version-win-x64-portable.zip"

if (Test-Path "out\win-unpacked") {
    Compress-Archive -Path "out\win-unpacked\*" -DestinationPath "out\$packageName" -CompressionLevel Optimal -Force
    
    $zipFile = Get-Item "out\$packageName"
    $sizeMB = [math]::Round($zipFile.Length / 1MB, 2)
    
    Write-Host "  ✓ ZIP 创建成功" -ForegroundColor Green
    Write-Host "    文件: $packageName" -ForegroundColor Cyan
    Write-Host "    大小: $sizeMB MB" -ForegroundColor Cyan
} else {
    Write-Host "  ✗ 找不到构建输出目录" -ForegroundColor Red
    exit 1
}

# 验证可执行文件
Write-Host "`n=== 验证结果 ===" -ForegroundColor Cyan
$exePath = "out\win-unpacked\exhentai-manga-manager.exe"
if (Test-Path $exePath) {
    $exeFile = Get-Item $exePath
    $exeSizeMB = [math]::Round($exeFile.Length / 1MB, 2)
    Write-Host "✓ EXE 文件: $exeSizeMB MB" -ForegroundColor Green
} else {
    Write-Host "✗ 未找到 EXE 文件!" -ForegroundColor Red
    exit 1
}

Write-Host "`n🎉 本地构建验证成功!" -ForegroundColor Green
Write-Host "   可以安全地推送到 GitHub 触发 Actions 构建" -ForegroundColor Cyan
Write-Host ""
Write-Host "下一步:" -ForegroundColor Yellow
Write-Host "  运行: .\republish-release.ps1" -ForegroundColor White
