# 编译后 IPC 错误修复总结

## 🐛 问题描述

编译后的便携版程序启动时出现错误：
```
Failed to load API config: Error: No handler registered for 'get-api-config'
Error invoking remote method 'load-setting': Error: No handler registered for 'load-setting'
```

以及批量翻译时的错误：
```
TypeError: ipcRenderer.removeListener is not a function
```

## 🔍 根本原因

### 1. IPC 处理器注册时序问题
- **问题**：数据库初始化是异步的但没有被等待
- **问题**：窗口创建在 IPC 处理器注册之前
- **结果**：前端页面加载时，后端 IPC 处理器还未注册完成

### 2. Modules 目录打包问题
- **问题**：`modules` 目录被打包进 `app.asar` 文件
- **问题**：动态 require 无法从 asar 中加载模块
- **结果**：`Cannot find module './modules/ipc_handlers/all_handlers'`

### 3. Preload API 不完整
- **问题**：`preload.js` 中没有暴露 `removeListener` 方法
- **结果**：前端无法移除事件监听器

## ✅ 修复方案

### 修复 1: 调整启动顺序 (`index.js`)

**之前的代码：**
```javascript
;(async () => {
  await Manga.sequelize.query(`PRAGMA journal_mode=WAL;`)
  // ... 数据库初始化
})()

app.whenReady().then(async () => {
  mainWindow = createWindow()  // 先创建窗口
  const { registerAllHandlers } = require('./modules/ipc_handlers/all_handlers')
  registerAllHandlers({...})   // 后注册 IPC
})
```

**修复后的代码：**
```javascript
// 数据库初始化 Promise - 确保在使用前完成初始化
const databaseInitPromise = (async () => {
  try {
    console.log('🔄 开始数据库初始化...')
    await Manga.sequelize.query(`PRAGMA journal_mode=WAL;`)
    // ... 数据库初始化
    console.log('✅ 数据库初始化完成')
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error)
    throw error
  }
})()

// IPC 处理器在顶部导入
const { registerAllHandlers } = require('./modules/ipc_handlers/all_handlers')

app.whenReady().then(async () => {
  try {
    // 1. 等待数据库初始化
    await databaseInitPromise
    
    // 2. 注册 IPC 处理器
    console.log('📝 注册IPC处理器...')
    registerAllHandlers({...})
    
    // 3. 创建窗口
    console.log('🪟 创建主窗口...')
    mainWindow = createWindow()
    
    console.log('✅ 应用启动完成')
  } catch (error) {
    console.error('❌ 应用启动失败:', error)
    app.quit()
  }
})
```

**关键改进：**
- ✅ 数据库初始化改为可等待的 Promise
- ✅ IPC 处理器模块在文件顶部导入（确保打包后正确加载）
- ✅ 严格的初始化顺序：数据库 → IPC → 窗口
- ✅ 详细的启动日志

### 修复 2: 配置 Modules 目录解包 (`package.json`)

**添加配置：**
```json
{
  "build": {
    "asarUnpack": [
      "modules/**/*"
    ],
    "files": [
      "modules/**/*",  // 改为 **/* 确保包含所有子目录
      // ... 其他文件
    ]
  }
}
```

**效果：**
- ✅ `modules` 目录从 `app.asar` 中解包到 `app.asar.unpacked`
- ✅ 允许动态 require 正确加载模块

### 修复 3: 完善 Preload API (`preload.js`)

**之前的代码：**
```javascript
contextBridge.exposeInMainWorld('ipcRenderer', {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  on: (channel, listener) => ipcRenderer.on(channel, listener),
  send: (channel, ...args) => ipcRenderer.send(channel, ...args),
  sendSync: (channel, ...args) => ipcRenderer.sendSync(channel, ...args),
  // 缺少 removeListener 和 off
})
```

**修复后的代码：**
```javascript
contextBridge.exposeInMainWorld('ipcRenderer', {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  on: (channel, listener) => ipcRenderer.on(channel, listener),
  send: (channel, ...args) => ipcRenderer.send(channel, ...args),
  sendSync: (channel, ...args) => ipcRenderer.sendSync(channel, ...args),
  removeListener: (channel, listener) => ipcRenderer.removeListener(channel, listener),
  off: (channel, listener) => ipcRenderer.off(channel, listener),
  ipcOn: (channel, listener) => {
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
})
```

## 📋 测试清单

### 本地测试
```powershell
# 使用构建测试脚本
.\build-test.ps1
```

### 手动测试步骤
1. **启动应用** - 检查是否有错误弹窗
2. **查看日志** - `out\win-unpacked\portable\log.txt`
   ```
   🔄 开始数据库初始化...
   ✅ 数据库初始化完成
   📝 注册IPC处理器...
   ✅ 所有IPC处理器已注册    ← 必须在创建窗口之前！
   🪟 创建主窗口...
   ✅ 应用启动完成
   ```
3. **测试设置页面** - 应该能正常加载（`load-setting` IPC）
4. **测试 AI 配置** - 应该能正常打开（`get-api-config` IPC）
5. **测试批量翻译** - 应该能正常工作（`removeListener` 功能）
6. **控制台检查** - F12 打开，不应该有 IPC 相关错误

## 🚀 发布流程

### 本地构建测试
```powershell
# 1. 清理并构建
yarn install --frozen-lockfile
yarn build
yarn dist

# 2. 验证构建产物
Test-Path "out\win-unpacked\resources\app.asar.unpacked\modules\ipc_handlers\all_handlers.js"
# 应该返回 True

# 3. 测试运行
.\out\win-unpacked\exhentai-manga-manager.exe
```

### GitHub Actions 自动发布
```bash
# 1. 提交修改
git add .
git commit -m "fix: 修复编译后 IPC 处理器注册和模块加载问题"

# 2. 推送到远程
git push origin dev

# 3. 创建版本标签（触发自动构建）
git tag v1.6.12.6
git push origin v1.6.12.6
```

## 📝 相关文件

修改的文件：
- `index.js` - 修复启动顺序
- `package.json` - 添加 asarUnpack 配置
- `preload.js` - 完善 IPC API
- `.gitignore` - 添加 build-output 目录
- `build-test.ps1` - 本地构建测试脚本（新增）
- `LOCAL_BUILD_TEST.md` - 详细测试指南（新增）

## 🎯 验证要点

### ✅ 启动顺序正确
```
数据库初始化 → IPC 注册 → 窗口创建
```

### ✅ Modules 正确解包
```
out/win-unpacked/resources/
  ├── app.asar                    (主程序打包)
  └── app.asar.unpacked/
      └── modules/                (解包的 modules)
          ├── ipc_handlers/
          │   ├── all_handlers.js
          │   └── ...
          └── ...
```

### ✅ IPC 功能正常
- 所有 IPC 处理器在窗口加载前注册
- 前端能正常调用所有 IPC 方法
- 事件监听器能正常添加和移除

## 🔗 参考文档

- [Electron Builder - ASAR](https://www.electron.build/configuration/configuration#Configuration-asarUnpack)
- [Electron Context Bridge](https://www.electronjs.org/docs/latest/api/context-bridge)
- [Electron IPC](https://www.electronjs.org/docs/latest/api/ipc-renderer)

## 💡 最佳实践

1. **IPC 处理器必须在窗口创建前注册**
2. **需要动态加载的模块必须从 asar 中解包**
3. **Preload 脚本应该暴露完整的 IPC API**
4. **本地构建测试与 CI/CD 保持一致**
5. **详细的启动日志有助于排查问题**

---

修复完成日期：2025-10-25
测试状态：✅ 本地测试通过，待 Actions 验证

