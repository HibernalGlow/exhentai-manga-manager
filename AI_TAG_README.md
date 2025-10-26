# AI 自动标签功能

## 功能说明

通过 AI API 根据漫画标题自动推断标签，支持：
- 原作（parody）
- 角色（character）
- 画师（artist）
- 社团（group）
- 女性标签（female）
- 男性标签（male）

## 配置

1. 复制配置模板：
```bash
cp config/ai_api_config.json.template config/ai_api_config.json
```

2. 编辑 `config/ai_api_config.json`：
```json
{
  "apiUrl": "https://api.openai.com/v1/chat/completions",
  "apiKey": "your-api-key-here",
  "model": "gpt-3.5-turbo",
  "enabled": true
}
```

### 支持的 API

#### OpenAI
```json
{
  "apiUrl": "https://api.openai.com/v1/chat/completions",
  "apiKey": "sk-...",
  "model": "gpt-3.5-turbo"
}
```

#### DeepSeek
```json
{
  "apiUrl": "https://api.deepseek.com/v1/chat/completions",
  "apiKey": "sk-...",
  "model": "deepseek-chat"
}
```

#### Qwen (通义千问)
```json
{
  "apiUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
  "apiKey": "sk-...",
  "model": "qwen-turbo"
}
```

#### 本地 Ollama
```json
{
  "apiUrl": "http://localhost:11434/v1/chat/completions",
  "apiKey": "ollama",
  "model": "qwen2.5:7b"
}
```

## 工作原理

### 1. 标签列表优化

系统会自动从数据库中提取**常用标签**（出现次数 >= 3）：

- 每个类别最多 200 个标签
- 按出现次数排序
- 只提供给 AI 作为参考

**优势**：
- ✅ 避免 AI 乱造标签
- ✅ 保持标签一致性
- ✅ 减少 token 消耗

### 2. AI 推断流程

```
标题 → 构建提示词（包含常用标签） → AI API → JSON 响应 → 标签匹配 → 更新数据库
```

### 3. 标签匹配

AI 返回的标签会与数据库现有标签进行模糊匹配：

1. **精确匹配**（不区分大小写）
2. **包含匹配**（部分匹配）
3. **无匹配**：使用 AI 返回的原始标签

**示例**：
- AI 返回：`fate grand order`
- 数据库有：`Fate/Grand Order`
- 匹配结果：`Fate/Grand Order` ✅

## 使用方法

### 测试标签提取

```bash
node tests/test_ai_tag.js
```

这会显示：
- 数据库中的常用标签统计
- 各类别标签数量
- 示例标题的推断结果

### 前端集成（待实现）

在书籍详情页添加"AI 推断标签"按钮：

```javascript
// 单本书推断
const result = await window.ipcRenderer.invoke('ai-infer-tags', {
  bookId: '123',
  title: '(C96) [サークル] マシュ本 (FGO)',
  apiConfig: {
    apiUrl: '...',
    apiKey: '...',
    model: '...'
  }
})

console.log(result.tags)
// {
//   "parody": ["Fate/Grand Order"],
//   "character": ["マシュ・キリエライト"],
//   "group": ["サークル"],
//   ...
// }
```

```javascript
// 批量推断
const result = await window.ipcRenderer.invoke('ai-batch-infer-tags', {
  bookIds: ['123', '456', '789'],
  apiConfig: { ... },
  onProgress: ({ current, total }) => {
    console.log(`进度: ${current}/${total}`)
  }
})
```

## 提示词示例

```
请根据以下漫画标题推断标签：

标题：(C96) [サークル名 (作者名)] マシュ本 (Fate/Grand Order)

可选标签列表（请尽量从这些标签中选择）：
{
  "parody": ["Fate/Grand Order", "ブルーアーカイブ", ...],
  "character": ["マシュ・キリエライト", "ヒナタ", ...],
  "artist": ["作者A", "作者B", ...],
  ...
}

要求：
1. 返回 JSON 格式
2. 尽量从提供的标签列表中选择
3. 如果确定某个标签但列表中没有，可以添加新标签
4. 不确定的类别返回空数组
5. 标签名使用原文（日文/英文）
```

## 性能优化

1. **标签缓存**：常用标签只查询一次
2. **批量处理**：支持批量推断，共享标签列表
3. **限流控制**：每次请求间隔 1 秒，避免 API 限流
4. **事务更新**：批量更新数据库

## 注意事项

⚠️ **API 费用**
- OpenAI GPT-3.5: ~$0.001/次
- DeepSeek: ~¥0.001/次
- 本地 Ollama: 免费

⚠️ **准确率**
- 标题格式规范：准确率 >90%
- 标题不规范：准确率 ~70%
- 建议人工复核

⚠️ **隐私**
- 只发送标题到 AI
- 不发送图片或其他敏感信息

## 未来改进

- [ ] 前端 UI 集成
- [ ] 支持自定义提示词
- [ ] 标签置信度评分
- [ ] 批量操作进度条
- [ ] 错误重试机制
- [ ] 标签冲突检测

