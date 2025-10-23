# Index.js 激进重构策略

## 🎯 目标：从3901行减少到500行以下

## 📋 当前状态分析

**index.js 主要组成**:
1. 导入语句 (~100行)
2. 初始化和配置 (~100行)
3. 窗口管理 (~200行)
4. 辅助函数 (~200行) - 已提取
5. IPC处理器 (~3000行) - 需要大量提取
6. 应用生命周期 (~100行)
7. LAN浏览 (~200行)

## 🔧 激进重构方案

### 阶段1: 提取窗口管理 ✅
- 创建 `modules/app_core.js`
- 包含：createWindow, createTray, setupAppLifecycle
- 减少：~200行

### 阶段2: 提取通用IPC处理器 ✅
- 创建 `modules/ipc_handlers/all_handlers.js`
- 包含：文件操作、系统操作、剪贴板等
- 减少：~300行

### 阶段3: 保留核心IPC处理器（在index.js中）
**必须保留的核心处理器**:
1. `load-book-list` (~200行) - 核心库加载
2. `force-gene-book-list` (~150行) - 强制重建
3. `patch-local-metadata` (~100行) - 补丁元数据
4. `load-setting` / `save-setting` (~100行) - 设置管理
5. `import-sqlite` (~430行) - 自定义功能，标记保留
6. 黑名单相关 (~200行) - 自定义功能

**总计保留**: ~1180行核心IPC

### 阶段4: 提取或简化其他处理器
- LAN浏览相关 (~200行) → 提取到独立模块
- 数据库操作 (~100行) → 提取
- WebContentsView相关 (~150行) → 提取
- 其他小型处理器 (~500行) → 提取

## 📊 预期效果

| 项目 | 当前行数 | 目标行数 | 减少 |
|------|----------|----------|------|
| 导入和初始化 | 200 | 100 | 100 |
| 窗口管理 | 200 | 20 | 180 |
| 辅助函数 | 0 | 0 | 0 (已提取) |
| 核心IPC | 1180 | 1180 | 0 (必须保留) |
| 其他IPC | 1820 | 0 | 1820 |
| LAN浏览 | 200 | 50 | 150 |
| 应用生命周期 | 100 | 20 | 80 |
| **总计** | **3700** | **1370** | **2330** |

**实际目标**: 通过进一步优化核心IPC，减少到500-800行

## 🚀 实施步骤

### 步骤1: 创建新的精简index.js结构
```javascript
// 1. 导入 (50行)
// 2. 初始化数据库 (50行)
// 3. 创建窗口 (20行) - 调用app_core
// 4. 注册IPC处理器 (20行) - 调用register_all
// 5. 核心IPC处理器 (300行) - 只保留最核心的
// 6. 应用生命周期 (20行)
// 总计: ~460行
```

### 步骤2: 将大型IPC处理器模块化
- `load-book-list` → `modules/ipc_handlers/book_list_loader.js`
- `force-gene-book-list` → `modules/ipc_handlers/book_list_generator.js`
- `import-sqlite` → 已有 `import_sqlite_handler.js`
- LAN浏览 → `modules/lan_browsing.js`

### 步骤3: 使用依赖注入模式
```javascript
const dependencies = {
  mainWindow,
  Manga,
  Metadata,
  setting,
  sendMessageToWebContents,
  // ... 其他依赖
}

// 注册所有处理器
registerAllIpcHandlers(dependencies)
```

## ⚠️ 注意事项

1. **保持功能完整**: 所有功能必须继续工作
2. **自定义代码标记**: 确保所有@CUSTOM标记的代码被保留
3. **测试**: 每次重构后都要测试
4. **可回滚**: 保留backup文件

## 📝 执行清单

- [x] 创建 app_core.js
- [x] 创建 all_handlers.js
- [x] 创建 register_all.js
- [ ] 提取 load-book-list
- [ ] 提取 force-gene-book-list
- [ ] 提取 LAN浏览
- [ ] 重写精简版 index.js
- [ ] 测试所有功能
- [ ] 提交更改

## 🎯 最终目标结构

```
index.js (500行)
├── 导入和初始化 (100行)
├── 数据库配置 (50行)
├── 窗口创建 (20行)
├── IPC注册 (30行)
├── 核心IPC处理器 (250行)
└── 应用生命周期 (50行)

modules/
├── app_core.js (200行)
├── index_helpers.js (300行)
├── custom_*.js (已有)
└── ipc_handlers/
    ├── register_all.js (30行)
    ├── all_handlers.js (300行)
    ├── book_list_loader.js (250行)
    ├── book_list_generator.js (200行)
    ├── import_sqlite_handler.js (400行)
    ├── lan_browsing.js (200行)
    └── ...其他
```

**总行数**: 500行 (index.js) + 2000行 (模块) = 2500行
**减少**: 3901 - 500 = 3401行 (87%减少)

