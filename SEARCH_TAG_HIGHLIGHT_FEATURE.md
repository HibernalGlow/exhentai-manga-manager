# 搜索标签高亮功能说明

## 功能概述

此功能为书籍卡片添加了智能标签高亮显示,包括:
1. **收藏标签显示** - 显示已收藏的标签(保持原有颜色)
2. **搜索标签高亮** - 高亮显示当前搜索的所有标签,即使未被收藏
3. **混合性别搜索** - 支持 f/m/x 标签跨性别匹配
4. **视觉区分** - 不同类型的标签使用不同的边框样式

## 修改文件

### 新增文件

#### `src/utils/tagFilter.js`
独立的标签过滤和高亮工具模块,包含以下函数:

- **`parseSearchTags(searchString, cat2letter)`**
  - 从搜索字符串中解析标签
  - 支持 `letter:"tag"` 格式
  
- **`isTagExactMatch(tagObject, cat, tag)`**
  - 检查标签是否精确匹配
  
- **`getAlternativeGenderCategories(cat)`**
  - 获取可跨性别匹配的类别
  
- **`checkMixedGenderMatch(tagObject, cat, tag, cat2letter)`**
  - 检查混合性别匹配
  
- **`filterAndHighlightTags(params)`**
  - 主函数:过滤并生成要显示的标签列表
  - 参数:
    - `tagObject`: 书籍的标签对象
    - `collectTags`: 收藏的标签数组
    - `searchString`: 搜索字符串
    - `enableMixedGender`: 是否启用混合性别搜索
    - `cat2letter`: 类别到字母的映射
    - `showCollectTag`: 是否显示收藏标签

### 修改文件

#### `src/App.vue`
- **第 140、200 行附近** - 在 `<BookCard>` 组件中添加 `:search-string="searchString"` prop
- 传递当前搜索字符串给 BookCard 组件

#### `src/components/BookCard.vue`
- **导入部分** - 添加 `import { filterAndHighlightTags } from '../utils/tagFilter.js'`
- **props 定义** - 添加 `searchString: String`
- **filterCollectTag 函数** - 简化为调用 `filterAndHighlightTags()`
- **样式部分** - 增强边框视觉效果:
  - `.mixed-match-tag`: 2px 虚线边框 + 阴影(跨性别匹配)
  - `.search-only-tag`: 3px 绿色点状边框 + 阴影(搜索但未收藏)

## 视觉效果说明

### 标签类型及样式

1. **普通收藏标签**
   - 实线边框
   - 收藏时设置的颜色
   - 完全不透明

2. **跨性别匹配的收藏标签** (`.mixed-match-tag`)
   - 2px 虚线边框
   - 90% 不透明度
   - 带阴影效果
   - 示例:收藏了 `f:loli`,书籍有 `x:loli`

3. **搜索但未收藏的标签** (`.search-only-tag`)
   - 3px 绿色点状边框
   - 95% 不透明度
   - 绿色发光阴影
   - 灰色背景(#606266)
   - 示例:搜索了 `f:glasses`,但未收藏此标签

4. **搜索且跨性别但未收藏** (同时具有两个 class)
   - 虚线 + 点状边框的组合效果
   - 灰色背景 + 绿色发光

## 技术细节

### 标签对象结构
```javascript
{
  cat: 'female',           // 标签类别
  tag: 'loli',            // 标签名称
  letter: 'f',            // 类别字母
  id: 'female-loli',      // 唯一标识
  color: '#E91E63',       // 显示颜色
  isCollected: true,      // 是否被收藏
  isSearchTag: true,      // 是否是搜索标签
  isMixedMatch: false     // 是否是跨性别匹配
}
```

### 去重逻辑
使用 `Set` 存储 `${cat}-${tag}` 键值,避免同一标签重复显示。

### 优先级
1. 先显示收藏标签(精确匹配 + 混合匹配)
2. 再显示搜索标签(精确匹配 + 混合匹配)
3. 已显示的标签不会重复添加

## 上游合并建议

此功能设计为**模块化**和**可选**:

1. **独立模块** - `tagFilter.js` 可以独立维护,不影响其他功能
2. **最小侵入** - 只修改了 App.vue 的 prop 传递和 BookCard.vue 的标签显示逻辑
3. **向后兼容** - 如果不传 `searchString`,功能退化为原有行为
4. **易于移除** - 如果不需要此功能,只需:
   - 删除 `src/utils/tagFilter.js`
   - 移除 App.vue 中的 `:search-string` prop
   - 还原 BookCard.vue 的 `filterCollectTag` 函数
   - 删除 `.mixed-match-tag` 和 `.search-only-tag` 样式

## 测试建议

1. 测试普通搜索:输入 `f:"loli"`,查看标签高亮
2. 测试混合性别搜索:启用开关后搜索 `f:"loli"`,查看 x:loli 的书籍
3. 测试未收藏标签:搜索未加入收藏的标签,查看绿色点状边框
4. 测试组合搜索:搜索多个标签,查看所有匹配标签的显示

## 性能考虑

- 标签解析使用正则表达式,效率高
- 使用 Set 去重,O(1) 查找复杂度
- 只在显示时计算,不影响搜索性能
- 适合中小规模标签列表(< 100 个标签/书籍)
