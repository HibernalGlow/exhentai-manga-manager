# 🎯 立即测试指南

所有修复已完成！现在进行最终测试。

## ✅ 已修复的问题

1. ✅ **IPC 处理器注册时序** - 数据库初始化 → IPC 注册 → 窗口创建
2. ✅ **Modules 目录打包** - 添加 `asarUnpack` 配置，正确解包
3. ✅ **Preload API** - 添加 `removeListener` 和 `off` 方法

## 🚀 开始测试

### 方式一：使用测试脚本（推荐）

```powershell
# 在项目根目录运行
.\build-test.ps1
```

这会自动：
- 关闭运行中的实例
- 清理旧构建
- 安装依赖
- 构建前端
- 打包 Electron
- 启动程序

### 方式二：手动测试

```powershell
# 1. 清理
Remove-Item dist, out -Recurse -Force -ErrorAction SilentlyContinue

# 2. 构建
yarn build
$env:npm_config_build_from_source = "false"
yarn dist

# 3. 运行
.\out\win-unpacked\exhentai-manga-manager.exe
```

## 🔍 测试重点

### 1. 程序能否正常启动
- ❌ 之前：出现 "No handler registered" 错误
- ✅ 现在：应该正常启动，无错误弹窗

### 2. 查看启动日志
```powershell
notepad .\out\win-unpacked\portable\log.txt
```

**应该看到正确的顺序：**
```
🔄 开始数据库初始化...
✅ 数据库初始化完成
📝 注册IPC处理器...
✅ 所有IPC处理器已注册    ← 关键！必须在创建窗口之前
🪟 创建主窗口...
✅ 应用启动完成
```

### 3. 测试设置页面
- 打开设置
- ✅ 应该能正常加载，不再出现 "No handler registered for 'load-setting'" 错误

### 4. 测试 AI 翻译配置
- 打开 AI 翻译配置
- ✅ 应该能正常加载，不再出现 "No handler registered for 'get-api-config'" 错误

### 5. 测试批量翻译
- 尝试批量翻译几本书
- ✅ 应该能正常工作，不再出现 "removeListener is not a function" 错误

### 6. 检查控制台（F12）
- 打开开发者工具
- ✅ 不应该有任何 IPC 相关的错误

## 📊 验证构建产物

### 检查 modules 是否正确解包
```powershell
Test-Path ".\out\win-unpacked\resources\app.asar.unpacked\modules\ipc_handlers\all_handlers.js"
```
应该返回：`True`

### 检查文件结构
```
out/win-unpacked/
  ├── exhentai-manga-manager.exe
  ├── resources/
  │   ├── app.asar                      (主程序)
  │   └── app.asar.unpacked/
  │       ├── modules/                  ← 解包的 modules
  │       │   ├── ipc_handlers/
  │       │   │   ├── all_handlers.js   ← 应该存在
  │       │   │   └── ...
  │       │   └── ...
  │       └── fileLoader/
  └── portable/                         (首次运行后创建)
      ├── database.sqlite
      ├── log.txt                       ← 查看这个
      └── ...
```

## ✅ 测试通过标准

所有以下项目都应该正常工作：
- [x] 程序正常启动，无错误弹窗
- [x] 启动日志显示正确的初始化顺序
- [x] 设置页面能正常打开和加载
- [x] AI 翻译配置能正常打开
- [x] 批量翻译功能正常工作
- [x] 控制台无 IPC 错误
- [x] modules 目录正确解包

## 🚢 测试通过后的发布流程

```bash
# 1. 提交所有修改
git add .
git commit -m "fix: 修复编译后 IPC 处理器注册、模块加载和 preload API 问题

- 修复 IPC 处理器注册时序，确保在窗口创建前完成
- 添加 asarUnpack 配置，正确解包 modules 目录
- 完善 preload.js，添加 removeListener 和 off 方法
- 添加详细的启动日志用于调试
- 创建构建测试脚本和文档"

# 2. 推送到远程
git push origin dev

# 3. 创建版本标签（触发 GitHub Actions 自动构建）
git tag v1.6.12.6
git push origin v1.6.12.6
```

## 📞 如果遇到问题

### 问题：文件被占用无法构建
```powershell
# 强制关闭所有实例
taskkill /F /IM exhentai-manga-manager.exe
Start-Sleep -Seconds 2

# 清理构建目录
Remove-Item out -Recurse -Force -ErrorAction SilentlyContinue
```

### 问题：modules 目录没有解包
检查 package.json 中是否有：
```json
"asarUnpack": ["modules/**/*"]
```

### 问题：仍然出现 IPC 错误
检查日志文件中的初始化顺序是否正确。

## 📝 相关文档

- `FIXES_SUMMARY.md` - 详细的修复总结
- `LOCAL_BUILD_TEST.md` - 本地构建测试指南
- `build-test.ps1` - 自动化测试脚本

---

**现在运行 `.\build-test.ps1` 开始测试！** 🚀

