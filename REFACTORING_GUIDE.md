# 代码重构说明 - Code Refactoring Guide

## 概述 (Overview)

为了方便与上游仓库保持同步，我们将自定义功能从 `index.js` 中分离到独立模块。

To facilitate syncing with the upstream repository, we have extracted custom features from `index.js` into separate modules.

## 新增模块 (New Modules)

### 1. `modules/string_utils.js`

**功能**: 字符串处理工具函数

**Functions**:
- `normalizeString(str)` - 归一化字符串（全角转半角、去除多余空格）
- `calculateSimilarity(str1, str2)` - 计算两个字符串的相似度（基于LCS算法）
- `getLCSLength(str1, str2)` - 计算最长公共子序列长度

**用途**: 
- 文件名归一化处理
- 标题匹配相似度计算
- 支持中日文全角半角混合文本

### 2. `modules/sqlite_import.js`

**功能**: SQLite 数据库导入相关功能

**Functions**:
- `buildTitleIndex(allTitles, hasHashColumn)` - 构建标题索引以加速匹配
- `findMatchesByTitle(searchTerm, originalFilename, titleMap, titleArray)` - 使用标题索引查找匹配项
- `refineMatchesWithJapaneseTitle(foundKeys, originalFilename, db)` - 使用日文标题精炼匹配结果
- `parseMetadataTags(metadata)` - 解析 SQLite 记录中的标签数据
- `matchByHash(book, hashIndex)` - 使用 hash 匹配书籍

**用途**:
- 从 EhViewer/ExHentai 数据库导入元数据
- 优化大型数据库的匹配性能
- 支持多种匹配策略（hash、精确标题、模糊标题）

### 3. `modules/init_folder_setting.js` (已存在，增强功能)

**新增功能**:
- `loadBlacklist(blacklistPath)` - 加载黑名单
- `saveBlacklist(blacklist, blacklistPath)` - 保存黑名单
- `clearBlacklist(blacklistPath)` - 清空黑名单
- `getBlacklistPath(blacklistPath)` - 获取黑名单文件路径

**用途**:
- 管理导入失败的书籍黑名单
- 避免重复尝试导入失败的项目

## 代码变更 (Code Changes)

### index.js 简化

**移除的代码** (Removed):
- 字符串归一化函数 (`normalizeString`, `calculateSimilarity`, `getLCSLength`)
- 标题索引构建逻辑（约60行代码）
- 复杂的匹配精炼逻辑（约80行代码）
- 元数据标签解析逻辑（约20行代码）

**新增的导入** (New Imports):
```javascript
const { normalizeString, calculateSimilarity } = require('./modules/string_utils')
const {
  buildTitleIndex,
  findMatchesByTitle,
  refineMatchesWithJapaneseTitle,
  parseMetadataTags,
  matchByHash
} = require('./modules/sqlite_import')
```

## 优势 (Benefits)

### 1. 易于维护 (Easy Maintenance)
- 自定义功能集中在独立模块
- 与上游代码分离，减少合并冲突
- 模块化设计，易于测试和调试

### 2. 代码复用 (Code Reuse)
- 工具函数可在其他地方重用
- 标准化的接口设计
- 便于添加新功能

### 3. 性能优化 (Performance)
- 独立模块可单独优化
- 清晰的函数边界
- 便于性能分析

## 与上游同步 (Syncing with Upstream)

### 同步步骤 (Sync Steps)

```bash
# 1. 获取上游更新
git fetch upstream

# 2. 合并上游更改
git merge upstream/dev

# 3. 如果 index.js 出现冲突：
#    - 检查冲突部分是否影响模块化代码
#    - 优先保留上游的核心逻辑
#    - 确保模块导入语句完整
#    - 确保模块函数调用正确

# 4. 测试功能
npm run build
npm start
```

### 冲突处理原则 (Conflict Resolution)

1. **核心逻辑**: 优先采用上游版本
2. **自定义功能**: 保留我们的模块化改进
3. **导入语句**: 确保两者都存在
4. **函数调用**: 使用我们的模块函数替代内联代码

### 需要注意的区域 (Areas to Watch)

在 `index.js` 中，以下区域可能需要手动合并：

1. **导入部分** (行 1-70)
   - 确保保留所有自定义模块的导入
   
2. **SQLite 导入函数** (行 1650-2100)
   - 这是主要的自定义区域
   - 使用模块函数替代内联实现
   
3. **黑名单功能** 
   - 确保 `loadBlacklist`, `saveBlacklist` 调用正确

## 测试清单 (Testing Checklist)

合并后请测试以下功能：

- [ ] 启动程序正常
- [ ] 导入 SQLite 数据库功能
- [ ] 快速匹配模式
- [ ] Hash 匹配
- [ ] 标题相似度匹配
- [ ] 黑名单加载和保存
- [ ] 进度显示
- [ ] 错误处理

## 回滚方案 (Rollback Plan)

如果合并后出现问题：

```bash
# 回滚到合并前
git reset --hard HEAD~1

# 或者创建备份分支
git branch backup-before-merge
```

## 联系和支持 (Contact)

如有问题，请检查：
1. 模块文件是否正确创建
2. 导入路径是否正确
3. 函数签名是否匹配
4. 依赖模块是否安装

---

**最后更新**: 2025-10-03
**版本**: v1.0
**维护者**: 你的项目团队
