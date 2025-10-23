# Index.js 重构计划 V2 - 实用方案

## 🎯 目标调整

**原目标**: 缩减到500行
**新目标**: 缩减到1500-2000行，保持可维护性

**原因**: 
- import-sqlite 单个处理器就有400+行
- 完全拆分会增加维护复杂度
- 需要平衡模块化和实用性

## 📊 当前状况

- **总行数**: 4102行
- **主要组成**:
  - 导入和初始化: ~200行
  - 辅助函数: ~300行
  - IPC处理器: ~3000行
  - 其他: ~600行

## 🔧 实用重构策略

### 阶段1: 模块化导入 ✅ (已完成)

- ✅ 创建 `custom_sqlite_import.js`
- ✅ 创建 `custom_blacklist.js`
- ✅ 更新 index.js 导入

**效果**: 减少约60行

### 阶段2: 提取辅助函数 (推荐)

创建 `modules/index_helpers.js`:

```javascript
// 包含以下函数:
- createAbortableContext()
- getEhviewerDataManually()
- findArchiveInFolder()
- pathExists()
- coverAndHashInMem()
- 其他辅助函数
```

**预计减少**: 300-500行

### 阶段3: 提取大型IPC处理器 (可选)

只提取最大的几个处理器:

1. **import-sqlite** (~400行) → `modules/ipc_handlers/import_sqlite.js`
2. **batch-get-metadata** (~200行) → `modules/ipc_handlers/batch_metadata.js`
3. **load-book-list** (~150行) → 保留在主文件（核心功能）
4. **force-gene-book-list** (~200行) → 保留在主文件（核心功能）

**预计减少**: 600行

### 阶段4: 组织代码结构 (推荐)

使用清晰的注释分隔不同部分:

```javascript
// ==================== 导入和初始化 ====================
// ==================== 数据库配置 ====================
// ==================== 辅助函数 ====================
// ==================== 窗口管理 ====================
// ==================== 核心IPC处理器 ====================
// ==================== 自定义IPC处理器 ====================
// ==================== 应用生命周期 ====================
```

## 📝 具体实施步骤

### 步骤1: 提取辅助函数 (立即执行)

```bash
# 创建辅助函数模块
touch modules/index_helpers.js

# 移动以下函数:
- createAbortableContext
- getEhviewerDataManually
- findArchiveInFolder
- pathExists
- coverAndHashInMem
- scanLibraryFilesWithExclude
- 等等...
```

### 步骤2: 标记代码区域 (立即执行)

在 index.js 中添加清晰的分隔注释

### 步骤3: 提取最大的IPC处理器 (可选)

只提取 import-sqlite 和 batch-get-metadata

### 步骤4: 测试验证

每个步骤后都要测试

## 🎯 预期效果

| 阶段 | 行数 | 减少 |
|------|------|------|
| 当前 | 4102 | - |
| 阶段1 | 4042 | 60 |
| 阶段2 | 3542 | 500 |
| 阶段3 | 2942 | 600 |
| 阶段4 | 2942 | 0 (组织) |

**最终目标**: ~2900行 (减少30%)

## ✅ 优先级

### 高优先级 (立即执行)
1. ✅ 模块化导入 (已完成)
2. ⏳ 提取辅助函数
3. ⏳ 添加代码区域标记

### 中优先级 (可选)
4. 提取 import-sqlite 处理器
5. 提取 batch-get-metadata 处理器

### 低优先级 (未来)
6. 进一步拆分其他处理器
7. 添加单元测试
8. 优化性能

## 🚀 立即行动

让我们先完成高优先级任务:
1. 提取辅助函数到 `modules/index_helpers.js`
2. 在 index.js 中添加清晰的区域标记
3. 测试确保一切正常

这样可以减少约500-600行，同时保持代码的可维护性。

