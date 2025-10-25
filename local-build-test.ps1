# 本地构建测试脚本 - 与 GitHub Actions 保持一致
# Local Build Test Script - Keep consistent with GitHub Actions

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  本地构建测试 (Local Build Test)" -ForegroundColor Cyan
Write-Host "  与 GitHub Actions 保持一致" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. 检查 Node.js 版本
Write-Host "1. 检查 Node.js 版本..." -ForegroundColor Yellow
$nodeVersion = node --version
Write-Host "   当前版本: $nodeVersion" -ForegroundColor Green
if ($nodeVersion -notmatch "v20") {
    Write-Host "   ⚠️  警告: GitHub Actions 使用 Node.js 20，当前版本不一致" -ForegroundColor Yellow
    $continue = Read-Host "   是否继续? (y/n)"
    if ($continue -ne "y") {
        exit 1
    }
}

# 2. 检查 yarn
Write-Host ""
Write-Host "2. 检查 Yarn..." -ForegroundColor Yellow
try {
    $yarnVersion = yarn --version
    Write-Host "   Yarn 版本: $yarnVersion" -ForegroundColor Green
} catch {
    Write-Host "   ❌ 错误: 未安装 Yarn" -ForegroundColor Red
    Write-Host "   请运行: npm install -g yarn" -ForegroundColor Yellow
    exit 1
}

# 3. 清理旧构建
Write-Host ""
Write-Host "3. 清理旧构建..." -ForegroundColor Yellow
if (Test-Path "dist") {
    Remove-Item -Path "dist" -Recurse -Force
    Write-Host "   ✅ 已清理 dist/" -ForegroundColor Green
}
if (Test-Path "out") {
    Remove-Item -Path "out" -Recurse -Force
    Write-Host "   ✅ 已清理 out/" -ForegroundColor Green
}

# 4. 创建 secret_key.json（如果不存在）
Write-Host ""
Write-Host "4. 检查 secret_key.json..." -ForegroundColor Yellow
if (-not (Test-Path "secret_key.json")) {
    Copy-Item "secret_key.json.template" "secret_key.json"
    Write-Host "   ✅ 已从模板创建 secret_key.json" -ForegroundColor Green
} else {
    Write-Host "   ✅ secret_key.json 已存在" -ForegroundColor Green
}

# 5. 安装依赖（使用 frozen-lockfile 保证一致性）
Write-Host ""
Write-Host "5. 安装依赖（frozen-lockfile 模式）..." -ForegroundColor Yellow
Write-Host "   这将确保与 GitHub Actions 使用相同的依赖版本" -ForegroundColor Cyan
yarn install --frozen-lockfile
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ❌ 依赖安装失败" -ForegroundColor Red
    exit 1
}
Write-Host "   ✅ 依赖安装成功" -ForegroundColor Green

# 6. 构建前端
Write-Host ""
Write-Host "6. 构建前端 (yarn build)..." -ForegroundColor Yellow
yarn build
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ❌ 前端构建失败" -ForegroundColor Red
    exit 1
}
Write-Host "   ✅ 前端构建成功" -ForegroundColor Green

# 7. 打包 Electron
Write-Host ""
Write-Host "7. 打包 Electron (yarn dist)..." -ForegroundColor Yellow
Write-Host "   使用预编译二进制，避免从源码编译" -ForegroundColor Cyan
$env:npm_config_build_from_source = "false"
yarn dist
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ❌ Electron 打包失败" -ForegroundColor Red
    exit 1
}
Write-Host "   ✅ Electron 打包成功" -ForegroundColor Green

# 8. 检查构建产物
Write-Host ""
Write-Host "8. 检查构建产物..." -ForegroundColor Yellow
$buildDir = Get-ChildItem -Path "out" -Directory -Filter "win-unpacked" -Recurse | Select-Object -First 1
if ($buildDir) {
    Write-Host "   ✅ 找到构建目录: $($buildDir.FullName)" -ForegroundColor Green
    
    # 检查主程序
    $exePath = Join-Path $buildDir.FullName "exhentai-manga-manager.exe"
    if (Test-Path $exePath) {
        $fileInfo = Get-Item $exePath
        Write-Host "   ✅ 主程序存在: exhentai-manga-manager.exe" -ForegroundColor Green
        Write-Host "      大小: $([math]::Round($fileInfo.Length / 1MB, 2)) MB" -ForegroundColor Cyan
    } else {
        Write-Host "   ❌ 未找到主程序" -ForegroundColor Red
        exit 1
    }
    
    # 列出关键文件
    Write-Host ""
    Write-Host "   关键文件检查:" -ForegroundColor Cyan
    $criticalFiles = @(
        "resources\app.asar",
        "dist\index.html",
        "index.js",
        "preload.js"
    )
    
    foreach ($file in $criticalFiles) {
        $fullPath = Join-Path $buildDir.FullName $file
        if (Test-Path $fullPath) {
            Write-Host "      ✅ $file" -ForegroundColor Green
        } else {
            Write-Host "      ❌ 未找到: $file" -ForegroundColor Red
        }
    }
    
    # 检查 modules 目录
    $modulesPath = Join-Path $buildDir.FullName "resources\app.asar.unpacked\modules"
    if (Test-Path $modulesPath) {
        Write-Host "      ✅ modules/ (已解包)" -ForegroundColor Green
        
        # 检查 IPC handlers
        $handlersPath = Join-Path $modulesPath "ipc_handlers"
        if (Test-Path $handlersPath) {
            Write-Host "      ✅ modules/ipc_handlers/" -ForegroundColor Green
        } else {
            Write-Host "      ⚠️  警告: 未找到 ipc_handlers/" -ForegroundColor Yellow
        }
    }
    
} else {
    Write-Host "   ❌ 未找到构建目录" -ForegroundColor Red
    exit 1
}

# 9. 创建便携版压缩包（可选）
Write-Host ""
$createZip = Read-Host "9. 是否创建便携版压缩包? (y/n)"
if ($createZip -eq "y") {
    Write-Host "   创建便携版压缩包..." -ForegroundColor Yellow
    
    # 从 package.json 读取版本号
    $packageJson = Get-Content "package.json" | ConvertFrom-Json
    $version = $packageJson.version
    
    $packageName = "exhentai-manga-manager-$version-win-x64-portable.zip"
    $packagePath = "out\$packageName"
    
    # 删除旧压缩包
    if (Test-Path $packagePath) {
        Remove-Item $packagePath -Force
    }
    
    # 创建压缩包
    Compress-Archive -Path "$($buildDir.FullName)\*" -DestinationPath $packagePath -CompressionLevel Optimal
    
    if (Test-Path $packagePath) {
        $zipInfo = Get-Item $packagePath
        Write-Host "   ✅ 已创建: $packageName" -ForegroundColor Green
        Write-Host "      大小: $([math]::Round($zipInfo.Length / 1MB, 2)) MB" -ForegroundColor Cyan
        Write-Host "      路径: $packagePath" -ForegroundColor Cyan
    }
}

# 10. 测试运行
Write-Host ""
$runTest = Read-Host "10. 是否启动程序进行测试? (y/n)"
if ($runTest -eq "y") {
    Write-Host "    启动程序..." -ForegroundColor Yellow
    $exePath = Join-Path $buildDir.FullName "exhentai-manga-manager.exe"
    Start-Process $exePath
    Write-Host "    ✅ 程序已启动，请测试以下功能:" -ForegroundColor Green
    Write-Host "       1. 程序是否正常启动" -ForegroundColor Cyan
    Write-Host "       2. 设置页面是否能正常加载 (load-setting)" -ForegroundColor Cyan
    Write-Host "       3. AI配置页面是否能正常加载 (get-api-config)" -ForegroundColor Cyan
    Write-Host "       4. 其他核心功能是否正常" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "    💡 提示: 检查程序目录下的 portable/log.txt 查看启动日志" -ForegroundColor Yellow
}

# 完成
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ✅ 构建测试完成!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "构建产物位置:" -ForegroundColor Yellow
Write-Host "  $($buildDir.FullName)" -ForegroundColor Cyan
Write-Host ""
Write-Host "下一步:" -ForegroundColor Yellow
Write-Host "  1. 测试构建的程序是否正常运行" -ForegroundColor Cyan
Write-Host "  2. 如果测试通过，可以提交代码并创建标签" -ForegroundColor Cyan
Write-Host "  3. GitHub Actions 将自动构建并发布" -ForegroundColor Cyan
Write-Host ""

