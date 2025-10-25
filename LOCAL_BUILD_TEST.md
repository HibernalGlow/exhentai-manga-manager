# 本地构建测试指南

本文档说明如何在本地进行与 GitHub Actions 一致的构建测试。

## 🎯 目的

确保本地构建结果与 GitHub Actions 自动构建的结果完全一致，避免"本地能跑，打包不行"的问题。

## 📋 前置要求

### 1. Node.js 版本
```bash
# GitHub Actions 使用 Node.js 20
node --version  # 应该是 v20.x.x
```

如果版本不是 20，请安装：
- 下载：https://nodejs.org/
- 或使用 nvm：`nvm install 20 && nvm use 20`

### 2. Yarn 包管理器
```bash
# 检查 Yarn
yarn --version

# 如果未安装
npm install -g yarn
```

### 3. 依赖项
```bash
# 使用 frozen-lockfile 确保版本一致
yarn install --frozen-lockfile
```

## 🚀 快速测试（推荐）

直接运行快速测试脚本：

```powershell
.\quick-build-test.ps1
```

这个脚本会：
1. ✅ 自动清理旧构建
2. ✅ 安装依赖（frozen-lockfile 模式）
3. ✅ 构建前端
4. ✅ 打包 Electron
5. ✅ 自动启动程序测试

## 🔍 详细测试

如果需要更详细的检查和日志：

```powershell
.\local-build-test.ps1
```

这个脚本会额外提供：
- 环境检查（Node.js 版本、Yarn 等）
- 构建产物详细检查
- 关键文件验证
- 可选的便携版压缩包创建

## 📝 手动步骤（了解构建流程）

如果你想手动执行每一步，以便更好地理解构建流程：

### 步骤 1: 清理旧构建
```powershell
Remove-Item -Path "dist" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "out" -Recurse -Force -ErrorAction SilentlyContinue
```

### 步骤 2: 准备配置文件
```powershell
# 如果 secret_key.json 不存在，从模板创建
if (-not (Test-Path "secret_key.json")) {
    Copy-Item "secret_key.json.template" "secret_key.json"
}
```

### 步骤 3: 安装依赖
```bash
# 使用 frozen-lockfile 确保与 Actions 一致
yarn install --frozen-lockfile
```

### 步骤 4: 构建前端
```bash
yarn build
```

这会在 `dist/` 目录生成前端资源。

### 步骤 5: 打包 Electron
```bash
# Windows PowerShell
$env:npm_config_build_from_source = "false"
yarn dist
```

这会在 `out/win-unpacked/` 目录生成可执行文件。

### 步骤 6: 测试运行
```powershell
# 运行打包后的程序
.\out\win-unpacked\exhentai-manga-manager.exe
```

## ✅ 关键测试点

运行程序后，请测试以下功能确保 IPC 处理器正常工作：

### 1. 程序启动
- [ ] 程序能否正常启动
- [ ] 主窗口能否显示
- [ ] 无 JavaScript 错误

### 2. IPC 处理器测试
- [ ] **load-setting**: 打开设置页面，检查设置是否正常加载
- [ ] **get-api-config**: 打开 AI 翻译配置，检查配置是否正常加载
- [ ] **load-collection-list**: 检查收藏列表是否正常
- [ ] **load-book-list**: 扫描书籍列表是否正常

### 3. 日志检查
查看日志文件确认启动流程：

```powershell
# 日志文件位置（便携模式）
notepad .\out\win-unpacked\portable\log.txt
```

应该看到类似的日志：
```
🔄 开始数据库初始化...
✅ 数据库初始化完成
📝 注册IPC处理器...
✅ 所有IPC处理器已注册
🪟 创建主窗口...
✅ 应用启动完成
```

**重要**：确保 IPC 处理器在窗口创建之前已注册！

## 🐛 常见问题

### 问题 1: "No handler registered for 'xxx'"

**原因**：IPC 处理器未正确注册

**解决**：
1. 检查 `index.js` 中 `app.whenReady()` 的执行顺序
2. 确保 `registerAllHandlers()` 在 `createWindow()` **之前**调用
3. 检查日志文件确认注册顺序

### 问题 2: 依赖安装失败

**原因**：yarn.lock 与本地环境不匹配

**解决**：
```bash
# 删除 node_modules 和缓存
Remove-Item -Path "node_modules" -Recurse -Force
Remove-Item -Path "yarn.lock" -Force

# 重新安装
yarn install
```

### 问题 3: 原生模块编译失败

**原因**：sharp、sqlite3 等原生模块需要编译

**解决**：
```bash
# 使用预编译二进制
$env:npm_config_build_from_source = "false"
yarn install

# 如果还是失败，安装构建工具
npm install --global --production windows-build-tools
```

### 问题 4: 打包后缺少文件

**原因**：electron-builder 配置的 files 列表不完整

**解决**：检查 `package.json` 的 `build.files` 配置：
```json
{
  "build": {
    "files": [
      "dist/index.html",
      "dist/assets/*",
      "modules/*",          // ← 确保包含
      "index.js",
      "preload.js"
    ]
  }
}
```

## 📊 与 GitHub Actions 的对比

| 项目 | GitHub Actions | 本地构建 |
|------|----------------|----------|
| Node.js | v20.x | 检查本地版本 |
| 包管理器 | yarn | yarn |
| 安装模式 | --frozen-lockfile | --frozen-lockfile |
| 构建脚本 | yarn build | yarn build |
| 打包脚本 | yarn dist | yarn dist |
| 预编译二进制 | npm_config_build_from_source=false | 需手动设置 |

## 🎉 测试通过后

如果所有测试都通过：

1. **提交修改**
   ```bash
   git add .
   git commit -m "fix: 修复 IPC 处理器注册时序问题"
   ```

2. **推送到远程**
   ```bash
   git push origin dev
   ```

3. **创建版本标签**（触发自动构建）
   ```bash
   # 更新 package.json 中的版本号后
   git tag v1.6.12.5
   git push origin v1.6.12.5
   ```

4. **等待 Actions 完成**
   - 访问：https://github.com/你的用户名/exhentai-manga-manager/actions
   - 查看构建进度
   - 构建完成后会自动创建 Release

## 📦 便携版测试

如果需要测试完整的便携版压缩包：

```powershell
# 创建压缩包
$version = "1.6.12.5"  # 从 package.json 获取
$packageName = "exhentai-manga-manager-$version-win-x64-portable.zip"
Compress-Archive -Path "out\win-unpacked\*" -DestinationPath "out\$packageName" -CompressionLevel Optimal

# 解压到新目录测试
Expand-Archive -Path "out\$packageName" -DestinationPath "test-portable"
.\test-portable\exhentai-manga-manager.exe
```

## 🔗 相关文档

- [RELEASE_GUIDE.md](.github/RELEASE_GUIDE.md) - 发布指南
- [BUILD_FIX.md](.github/BUILD_FIX.md) - 构建修复说明
- [electron-builder 文档](https://www.electron.build/)

## 💡 最佳实践

1. **每次发布前都在本地测试**
2. **使用 frozen-lockfile 保证一致性**
3. **检查日志文件确认启动流程**
4. **测试所有关键功能**
5. **在干净的目录下解压测试便携版**

---

如有问题，请查看：
- Actions 运行日志
- portable/log.txt
- GitHub Issues

