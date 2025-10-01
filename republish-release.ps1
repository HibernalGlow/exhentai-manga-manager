# GitHub Release 重新发布脚本
# 在网络稳定时运行此脚本

Write-Host "=== 删除旧标签 ===" -ForegroundColor Yellow

# 删除本地标签(如果存在)
try {
    git tag -d v1.6.10.1 2>$null
    Write-Host "✓ 本地标签已删除" -ForegroundColor Green
} catch {
    Write-Host "  本地标签不存在或已删除" -ForegroundColor Gray
}

# 删除远程标签
try {
    git push origin :refs/tags/v1.6.10.1 2>&1 | Out-Null
    Write-Host "✓ 远程标签已删除" -ForegroundColor Green
} catch {
    Write-Host "  远程标签可能不存在" -ForegroundColor Gray
}

Start-Sleep -Seconds 2

Write-Host "`n=== 创建新标签 ===" -ForegroundColor Yellow

# 创建新标签
git tag v1.6.10.1
Write-Host "✓ 本地标签已创建" -ForegroundColor Green

Start-Sleep -Seconds 2

Write-Host "`n=== 推送新标签 ===" -ForegroundColor Yellow

# 推送标签
$maxRetries = 3
$retryCount = 0
$success = $false

while (-not $success -and $retryCount -lt $maxRetries) {
    try {
        git push origin v1.6.10.1 2>&1 | Tee-Object -Variable output
        if ($LASTEXITCODE -eq 0) {
            $success = $true
            Write-Host "✓ 标签已推送" -ForegroundColor Green
            Write-Host "`n🎉 完成! GitHub Actions 将自动开始构建" -ForegroundColor Green
            Write-Host "   查看进度: https://github.com/HibernalGlow/exhentai-manga-manager/actions" -ForegroundColor Cyan
        } else {
            throw "Push failed with exit code $LASTEXITCODE"
        }
    } catch {
        $retryCount++
        if ($retryCount -lt $maxRetries) {
            Write-Host "✗ 推送失败，5秒后重试 ($retryCount/$maxRetries)..." -ForegroundColor Yellow
            Start-Sleep -Seconds 5
        } else {
            Write-Host "✗ 推送失败，已达到最大重试次数" -ForegroundColor Red
            Write-Host "  错误: $_" -ForegroundColor Red
            Write-Host "`n手动推送命令:" -ForegroundColor Yellow
            Write-Host "  git push origin v1.6.10.1" -ForegroundColor White
        }
    }
}

if ($success) {
    Write-Host "`n=== 验证 ===" -ForegroundColor Yellow
    Write-Host "检查远程标签..."
    Start-Sleep -Seconds 2
    git ls-remote --tags origin | Select-String "v1.6.10.1"
}
