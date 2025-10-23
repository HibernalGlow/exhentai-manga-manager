# Index.js 重构指南

## 🎯 重构目标

1. **模块化**：将自定义功能拆分到独立模块
2. **易于合并**：减少与上游代码的冲突
3. **可维护性**：清晰的代码结构和职责分离
4. **向后兼容**：不影响现有功能

## 📁 新模块结构

```
modules/
├── custom_sqlite_import.js    # 自定义SQLite导入和标题匹配
├── custom_blacklist.js         # 自定义黑名单管理
├── custom_batch_metadata.js    # 自定义批量元数据获取（待创建）
├── sqlite_import.js            # 原有功能（保持不变）
├── string_utils.js             # 原有功能（保持不变）
├── clean_utils.js              # 原有功能（保持不变）
└── sha1_archive_matcher.js     # 原有功能（保持不变）
```

## 🔄 重构步骤

### 第一阶段：创建模块包装器 ✅

1. **custom_sqlite_import.js** - 已完成
   - 整合 string_utils 和 sqlite_import 功能
   - 包含标题索引缓存
   - 统一导出接口

2. **custom_blacklist.js** - 已完成
   - 整合黑名单相关功能
   - 添加辅助函数
   - 统一导出接口

### 第二阶段：重构 index.js（推荐方案）

#### 方案A：渐进式重构（推荐）

**优点**：
- 风险小，可以逐步测试
- 不影响现有功能
- 容易回滚

**步骤**：

1. **替换导入语句**
```javascript
// 旧的导入（保留作为注释）
/*
const { 
  normalizeString, 
  calculateSimilarity,
  generateVariants
} = require('./modules/string_utils')
const {
  buildTitleIndex,
  findMatchesByTitle,
  // ...
} = require('./modules/sqlite_import')
*/

// 新的导入（使用模块包装器）
const {
  normalizeString,
  calculateSimilarity,
  generateVariants,
  buildTitleIndex,
  findMatchesByTitle,
  refineMatchesWithJapaneseTitle,
  parseMetadataTags,
  matchByHash,
  matchBySha1FromArchive,
  matchBySha1Online,
  titleIndexCache
} = require('./modules/custom_sqlite_import')

const {
  loadBlacklist,
  saveBlacklist,
  clearBlacklist,
  getBlacklistPath,
  isInBlacklist,
  addToBlacklist,
  removeFromBlacklist
} = require('./modules/custom_blacklist')
```

2. **移除内联代码**
```javascript
// 删除 index.js 中的 titleIndexCache 定义（第80-110行）
// 因为已经在 custom_sqlite_import.js 中定义
```

3. **测试验证**
```bash
yarn start
# 测试所有自定义功能是否正常工作
```

#### 方案B：完全重构（高级）

创建更多专门的模块：

```javascript
// modules/custom_batch_metadata.js
// 批量获取元数据的所有逻辑

// modules/custom_ipc_handlers.js  
// 所有自定义IPC处理器

// modules/custom_database.js
// 自定义数据库操作
```

### 第三阶段：标记自定义代码区域

在 index.js 中使用清晰的注释标记：

```javascript
// ==================== 自定义功能开始 ====================
// 这部分是本地自定义功能，合并时需要特别注意

// 自定义SQLite导入功能
ipcMain.handle('import-sqlite', async (event, arg) => {
  // ... 自定义代码
})

// 自定义批量获取元数据
ipcMain.handle('batch-get-metadata', async (event, arg) => {
  // ... 自定义代码
})

// ==================== 自定义功能结束 ====================
```

## 📝 合并策略

### 未来合并上游更新时

1. **使用三方合并**
```bash
git merge upstream/dev
```

2. **冲突处理原则**
   - **上游新增的文件**：直接接受
   - **上游修改的共享文件**：
     - 如果是 index.js：仔细审查，保留自定义功能
     - 如果是其他文件：优先使用上游版本
   - **自定义模块文件**：保留本地版本

3. **使用 git rerere**（记录冲突解决方案）
```bash
git config rerere.enabled true
```

### 标记策略

在关键的自定义代码处添加标记：

```javascript
// @CUSTOM: 自定义功能 - 批量元数据获取
// @REASON: 支持从多个来源批量获取和匹配元数据
// @CONFLICT_RESOLUTION: 合并时保留此代码块
ipcMain.handle('batch-get-metadata', async (event, arg) => {
  // ...
})
```

## 🔍 代码审查清单

合并后需要检查的关键点：

- [ ] 所有自定义IPC处理器是否保留
- [ ] 自定义模块导入是否正确
- [ ] titleIndexCache 是否正常工作
- [ ] 黑名单功能是否正常
- [ ] SHA1匹配功能是否正常
- [ ] 批量获取元数据功能是否正常
- [ ] 没有重复的函数定义
- [ ] 没有未使用的导入

## 🚀 实施计划

### 立即执行（低风险）

1. ✅ 创建 custom_sqlite_import.js
2. ✅ 创建 custom_blacklist.js
3. ⏳ 更新 index.js 的导入语句
4. ⏳ 移除 index.js 中的 titleIndexCache 定义
5. ⏳ 测试所有功能

### 后续优化（可选）

1. 创建 custom_batch_metadata.js
2. 创建 custom_ipc_handlers.js
3. 进一步拆分大型函数
4. 添加单元测试

## 📊 重构前后对比

### 重构前
```
index.js (4136行)
├── 所有导入混在一起
├── titleIndexCache 内联定义
├── 自定义功能和上游功能混合
└── 难以识别哪些是自定义代码
```

### 重构后
```
index.js (约3900行)
├── 清晰的模块导入
├── 自定义功能标记明确
└── 易于合并和维护

modules/
├── custom_sqlite_import.js (80行)
├── custom_blacklist.js (70行)
└── 其他自定义模块...
```

## ⚠️ 注意事项

1. **不要修改原有模块**
   - sqlite_import.js
   - string_utils.js
   - clean_utils.js
   - sha1_archive_matcher.js
   
   这些文件保持原样，只通过包装器使用

2. **保持向后兼容**
   - 所有现有功能必须继续工作
   - API接口不变

3. **测试充分**
   - 每次修改后都要测试
   - 特别是自定义功能

4. **文档更新**
   - 更新 README 说明自定义功能
   - 记录重要的设计决策

## 🔗 相关文档

- [UPSTREAM_FEATURES_CHECKLIST.md](./UPSTREAM_FEATURES_CHECKLIST.md) - 功能验证清单
- [UPSTREAM_CHANGES.md](./UPSTREAM_CHANGES.md) - 上游变更说明
- [modules/README.md](./modules/README.md) - 模块说明（待创建）

## 📞 问题反馈

如果在重构过程中遇到问题：
1. 检查控制台错误日志
2. 验证模块导入路径
3. 确认所有依赖都已安装
4. 回滚到上一个工作版本

