# SQL筛选工具模块

## 📁 文件说明

### sqlFilter.js

用于优化大数据集筛选性能的SQL查询工具模块。

## 🎯 主要功能

### 1. filterBooksBySQL(filterType, bookList, filterBooksByMemory)

使用SQL数据库查询代替内存过滤，大幅提升筛选性能。

**支持的筛选类型**:
- `mark` - 收藏的书籍
- `hidden` - 隐藏的书籍  
- `notag` - 未标记的书籍
- `nocategory` - 无分类的书籍
- `duplicateGallery` - 重复URL的画廊（按URL分组排序）

**性能优势**:
- SQL查询: ~75ms
- Map索引构建: ~5-10ms
- 数据转换: ~10-20ms
- **总耗时**: ~90-105ms

**对比内存过滤**:
- 内存过滤: ~2000-5000ms
- **性能提升**: 20-50倍

**使用示例**:
```javascript
import { filterBooksBySQL } from './utils/sqlFilter.js'

// 在Vue组件中
const filteredBooks = await filterBooksBySQL(
  'duplicateGallery', 
  this.bookList, 
  this.filterBooksByMemory
)
```

### 2. sortByUrlGroup(bookList)

按URL分组排序书籍列表，同一URL的书籍会被排在一起。

**排序规则**:
1. 有URL的书籍按URL字母顺序排序
2. 同一URL的书籍按hash排序
3. 没有URL的书籍放在最后

**使用示例**:
```javascript
import { sortByUrlGroup } from './utils/sqlFilter.js'

const sortedBooks = sortByUrlGroup(this.bookList)
```

### 3. isDuplicateGallery(book, bookList)

检查书籍是否有重复URL。

**返回值**:
- `true` - 该书籍的URL在列表中出现多次
- `false` - 该书籍没有URL或URL唯一

**使用示例**:
```javascript
import { isDuplicateGallery } from './utils/sqlFilter.js'

const hasDuplicate = isDuplicateGallery(book, this.bookList)
```

## 🔧 技术实现

### SQL查询优化

**重复URL筛选查询**:
```sql
SELECT * FROM Metadata
WHERE url IN (
  SELECT url FROM Metadata
  WHERE url IS NOT NULL AND url != ""
  GROUP BY url HAVING COUNT(*) > 1
)
ORDER BY url, hash
```

### Map索引加速

使用JavaScript Map数据结构实现O(1)查找：

```javascript
// 构建索引
const bookMap = new Map()
bookList.forEach(book => {
  if (book.hash) bookMap.set(book.hash, book)
})

// 快速查找
const book = bookMap.get(metadata.hash)
```

**性能对比**:
- `Array.find()`: O(n) - 每次查找遍历整个数组
- `Map.get()`: O(1) - 哈希表直接定位

对于4408个SQL结果和28328个书籍：
- Array.find: ~1.24亿次比较
- Map.get: 4408次查找

## 📊 性能监控

模块提供详细的性能日志：

```
🔍 开始SQL筛选: duplicateGallery
✅ Metadata SQL查询完成，耗时: 74.52ms，结果数量: 4408
🗺️ 建立Map索引耗时: 5.23ms, 索引大小: 28328
🔄 数据转换耗时: 12.45ms, 匹配到: 4408/4408
✅ SQL筛选完成: duplicateGallery, 耗时: 92.20ms, 结果数量: 4408
```

## 🛡️ 错误处理

- 自动检测SQL查询结果有效性
- 遇到错误自动回退到内存过滤
- 完整的错误日志记录

## 📝 使用注意事项

1. **首次调用**: 需要时间构建Map索引
2. **内存占用**: Map索引会占用额外内存，但换来的是极快的查询速度
3. **自动回退**: 不支持SQL查询的类型会自动使用内存过滤

## 🔄 集成方式

在 `App.vue` 中导入：

```javascript
import { filterBooksBySQL, sortByUrlGroup, isDuplicateGallery } from './utils/sqlFilter.js'
```

在方法中使用：

```javascript
methods: {
  async filterBooksBySQLWrapper(filterType, bookList) {
    return await filterBooksBySQL(filterType, bookList, this.filterBooksByMemory)
  }
}
```

## 🎉 功能特性

✅ 极速筛选 - 20-50倍性能提升  
✅ 智能回退 - 自动处理异常情况  
✅ URL分组 - 重复URL自动按顺序排列  
✅ 详细日志 - 完整的性能监控  
✅ 模块化 - 独立文件，易于维护
