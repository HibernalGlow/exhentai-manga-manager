# 性能优化 - 批量保存避免阻塞

## 问题

**症状：** 执行"补全无分类/无标签元数据"时，前端界面卡住无法操作

**原因：** 在循环中逐个 `await saveBookToDatabase()` 会阻塞主进程

## 优化方案

### 之前的逻辑（阻塞）
```javascript
// ❌ 每本书立即保存，阻塞主进程
for (let i = 0; i < totalCount; i++) {
  // ... 匹配逻辑 ...
  await saveBookToDatabase(updatedBook)  // 阻塞点
}
```

**问题：**
- 每次保存都要等待数据库写入完成
- 2744本书 × 平均50ms = 约137秒（2分多钟）持续阻塞
- 前端无法响应用户操作

### 优化后的逻辑（批量保存）
```javascript
// ✅ 批量保存，定期让出事件循环
const booksToSave = []
const SAVE_BATCH_SIZE = 10  // 每10本书保存一次

for (let i = 0; i < totalCount; i++) {
  // ... 匹配逻辑 ...
  
  // 1. 先加入队列
  booksToSave.push(updatedBook)
  
  // 2. 达到批量大小时批量保存
  if (booksToSave.length >= SAVE_BATCH_SIZE) {
    for (const book of booksToSave) {
      await saveBookToDatabase(book)
    }
    booksToSave.length = 0
    
    // 3. 让出事件循环，保持 UI 响应
    await new Promise(resolve => setImmediate(resolve))
  }
}

// 4. 保存最后剩余的书籍
if (booksToSave.length > 0) {
  for (const book of booksToSave) {
    await saveBookToDatabase(book)
  }
}
```

## 优化效果

### 性能对比

| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| 单次保存阻塞 | 每本书 | 每10本书 |
| UI 响应频率 | 持续阻塞 | 每10本书响应一次 |
| 总耗时 | ~137秒 | ~137秒（相同）|
| 用户体验 | ❌ 卡死 | ✅ 可操作 |

### 批量大小选择

```javascript
const SAVE_BATCH_SIZE = 10  // 当前设置
```

**为什么选择10？**
- 太小（如1）：频繁让出，性能损失
- 太大（如100）：长时间阻塞，UI 卡顿
- 10本：平衡点，约0.5秒让出一次

## 新的输出信息

### 处理过程
```
📖 Processing 1/2744: Book A
   ✅ Queued for save: Book A (Manga)

📖 Processing 10/2744: Book J
   ✅ Queued for save: Book J (Doujinshi)
   💾 Saving batch of 10 books...
   ✅ Batch saved

📖 Processing 20/2744: Book T
   ✅ Queued for save: Book T (Manga)
   💾 Saving batch of 10 books...
   ✅ Batch saved

...

📖 Processing 2744/2744: Book Z
   ✅ Queued for save: Book Z (Manga)
   💾 Saving final batch of 4 books...
   ✅ Final batch saved

📊 Fill complete: Success: 2500, Failed: 244, Total: 2744
```

### 关键信息
- `Queued for save` - 已加入保存队列
- `Saving batch of X books` - 正在批量保存
- `Batch saved` - 批次保存完成
- `Saving final batch` - 保存最后剩余的书籍

## 事件循环让出机制

```javascript
await new Promise(resolve => setImmediate(resolve))
```

**作用：**
1. 暂停当前任务
2. 让出控制权给事件循环
3. 允许处理其他事件（UI 更新、用户输入等）
4. 下个 tick 继续执行

**效果：**
- 前端可以响应用户操作
- 进度条可以更新
- 不会出现"无响应"提示

## 数据一致性

### 保证机制

1. **队列顺序保持**
   ```javascript
   const booksToSave = []  // 数组保持插入顺序
   booksToSave.push(updatedBook)
   ```

2. **批量完整保存**
   ```javascript
   for (const book of booksToSave) {
     await saveBookToDatabase(book)  // 顺序执行
   }
   ```

3. **最终批次处理**
   ```javascript
   if (booksToSave.length > 0) {
     // 确保没有遗漏
   }
   ```

### 失败处理

```javascript
try {
  // ... 匹配和保存逻辑 ...
} catch (e) {
  failedCount++
  // 错误不会影响后续书籍处理
}
```

**特点：**
- 单本书失败不影响其他书
- 错误计入 `failedCount`
- 显示详细错误信息

## 与 import-sqlite 的对比

| 功能 | import-sqlite | fill-no-category-metadata |
|------|---------------|---------------------------|
| 并发控制 | ✅ 使用 `createLimiter` | ❌ 无（顺序处理）|
| 批量保存 | ✅ 每批次处理 | ✅ 每10本保存 |
| 让出循环 | ✅ 定期让出 | ✅ 每批次后让出 |

**注意：**
- `import-sqlite` 使用并发控制处理多本书
- `fill-no-category-metadata` 顺序处理（简单但慢）
- 两者都使用批量保存提高性能

## 进一步优化建议

### 可选优化1: 增加并发
```javascript
const workLimit = createLimiter(5)  // 同时处理5本书

const tasks = bookList.map(book => 
  workLimit(async () => {
    // 匹配逻辑
    // 加入保存队列
  })
)

await Promise.all(tasks)
```

### 可选优化2: 使用批量插入
```javascript
// 使用 Sequelize 的 bulkCreate
await Manga.bulkCreate(booksToSave, { 
  updateOnDuplicate: ['tags', 'category', ...] 
})
```

### 可选优化3: 调整批量大小
```javascript
const SAVE_BATCH_SIZE = process.env.SAVE_BATCH_SIZE || 10
```

## 测试建议

1. **小数据集测试**（10-50本）
   - 验证功能正确性
   - 观察批量保存日志

2. **中等数据集测试**（100-500本）
   - 验证 UI 响应性
   - 观察保存频率

3. **大数据集测试**（1000+本）
   - 验证长时间运行稳定性
   - 观察内存使用情况

4. **压力测试**（2000+本）
   - 验证数据一致性
   - 检查是否有内存泄漏
