# AI 标签推断功能实现总结

## 功能概述

在翻译 tab 下新增了「AI 标签」功能，可以通过 AI API 根据书籍标题自动推断标签（原作、角色、画师、社团等）。

## 实现的文件

### 前端

#### `src/components/Setting.vue`
- 在翻译 tab 后添加了「AI 标签」tab
- 实现的 UI 组件：
  - API 配置文件路径显示和编辑按钮
  - API 配置信息展示（URL、Model、状态）
  - 测试 API 连接按钮
  - 查看标签统计按钮
  - 批量推断设置（数量、间隔）
  - 批量推断和停止按钮
  - 进度条显示
  - 使用说明和注意事项

- 实现的功能：
  - `loadAiApiConfig()` - 加载 AI API 配置
  - `openAiApiConfigFile()` - 打开配置文件编辑
  - `testAiApiConnection()` - 测试 API 连接
  - `showTagStatistics()` - 显示标签统计
  - `batchInferTags()` - 批量推断标签
  - `stopBatchInfer()` - 停止批量推断

### 后端

#### `modules/ipc_handlers/ai_tag_handlers.js`（新建）
- 注册 AI 标签相关的 IPC 处理器
- 实现的 IPC 处理器：
  - `load-ai-api-config` - 加载配置文件
  - `open-ai-api-config-file` - 打开配置文件
  - `get-existing-tags` - 获取数据库现有标签列表
  - `ai-infer-tags` - AI 推断单本书的标签
  - `ai-batch-infer-tags` - 批量 AI 推断标签

- 核心功能函数：
  - `getExistingTagsForAI(db)` - 获取常用标签（出现次数 >= 3，每类最多 200 个）
  - `callAiApi(title, existingTags, apiConfig)` - 调用 AI API
  - `buildPrompt(title, existingTags)` - 构建 AI 提示词
  - `matchAndNormalizeTags(db, inferredTags)` - 标签匹配和规范化
  - `findBestMatch(tag, existingTags)` - 模糊匹配标签
  - `mergeTags(currentTags, newTags)` - 合并标签

#### `modules/ipc_handlers/register_all.js`
- 添加了 `registerAiTagHandlers` 的导入和注册

### 配置

#### `config/ai_api_config.json.template`（更新）
- 添加了完整的配置字段：
  - `enabled` - 是否启用
  - `apiUrl` - API 地址
  - `apiKey` - API 密钥
  - `model` - 模型名称
  - `maxTokens` - 最大 token 数
  - `temperature` - 温度参数
  - `minTagCount` - 最小标签出现次数

### 测试

#### `tests/test_ai_tag_full.js`（新建）
- 测试标签列表获取
- 测试 AI 提示词构建
- 测试标签优化策略
- 提供测试标题和期望结果

### 文档

#### `AI_TAG_README.md`（更新）
- 添加了通过设置界面配置的说明
- 更新了配置示例
- 添加了详细的使用方法

## 技术亮点

### 1. 标签列表优化
- 只提取出现次数 >= 3 的常用标签
- 每个类别最多 200 个标签
- 按出现次数排序
- 提示词中每类最多 50 个示例
- **效果**：避免 AI 乱造标签，保持一致性，减少 token 消耗

### 2. 标签模糊匹配
- 精确匹配（不区分大小写）
- 包含匹配（部分匹配）
- 无匹配时使用原始标签
- **效果**：AI 返回的标签能自动匹配数据库现有标签格式

### 3. API 兼容性
- 支持 OpenAI 兼容的所有 API
- 包括：OpenAI、DeepSeek、Qwen、Gemini、本地 Ollama
- **效果**：用户可以选择最经济的 API 服务

### 4. 批量处理优化
- 只处理 `non-tag` 或 `tag-failed` 状态的书籍
- 可配置批量数量和请求间隔
- 支持中途停止
- 实时进度显示
- **效果**：避免重复处理，控制 API 调用频率

### 5. 用户体验
- 在设置界面集成，无需命令行
- 一键打开配置文件编辑
- 测试 API 连接功能
- 查看标签统计功能
- 详细的使用说明和注意事项
- **效果**：降低使用门槛，提高易用性

## 使用流程

1. **配置 API**
   - 打开设置 → AI 标签 tab
   - 点击「编辑配置」
   - 填写 API 信息并保存
   - 设置 `"enabled": true`

2. **测试连接**
   - 点击「测试 API 连接」
   - 验证配置是否正确

3. **查看标签统计**
   - 点击「查看标签统计」
   - 了解数据库中的标签分布

4. **批量推断**
   - 设置批量数量（建议 10-20）
   - 设置请求间隔（建议 1000ms）
   - 点击「批量推断标签」
   - 等待处理完成或中途停止

## 成本估算

- **OpenAI GPT-3.5-turbo**: 约 $0.003/本
- **DeepSeek**: 约 ¥0.001/本
- **Qwen**: 约 ¥0.002/本
- **本地 Ollama**: 免费

假设有 1000 本书需要推断：
- OpenAI: $3
- DeepSeek: ¥1
- Qwen: ¥2
- Ollama: ¥0

## 注意事项

1. **API 限流**
   - 建议设置请求间隔 >= 1000ms
   - 批量数量不要太大（10-20 为宜）

2. **标签质量**
   - AI 推断结果建议人工复核
   - 特别是新标签（数据库中不存在的）

3. **数据备份**
   - 批量推断前建议备份数据库
   - 推断结果会直接更新数据库

4. **Token 消耗**
   - 每次推断约消耗 9000 字符（约 3000 tokens）
   - 使用 DeepSeek 等低成本 API 可大幅降低费用

## 后续优化方向

1. **多语言支持**
   - 添加英文、日文界面翻译

2. **批量推断优化**
   - 支持选择特定文件夹进行推断
   - 支持按条件筛选书籍（如特定原作）

3. **标签建议**
   - 在编辑标签时提供 AI 建议
   - 单本书快速推断按钮

4. **统计分析**
   - 推断成功率统计
   - 标签覆盖率分析
   - API 调用成本统计

5. **Prompt 优化**
   - 根据标题特征动态调整 prompt
   - 支持自定义 prompt 模板

## 测试结果

运行 `node tests/test_ai_tag_full.js` 的输出：

```
标签统计（出现次数 >= 3）:
  artist: 200 个
  female: 200 个
  parody: 200 个
  character: 200 个
  group: 200 个
  male: 200 个
  cosplayer: 68 个
  other: 54 个
  language: 20 个
  mixed: 12 个
  rest: 7 个
  location: 0 个

Prompt 长度: 约 8900 字符
```

标签优化策略已成功实现，prompt 长度控制在合理范围内。

## 总结

AI 标签推断功能已完整实现，包括：
- ✅ 前端 UI（设置界面）
- ✅ 后端逻辑（IPC 处理器）
- ✅ 标签列表优化
- ✅ AI API 调用
- ✅ 标签匹配和规范化
- ✅ 批量处理
- ✅ 配置管理
- ✅ 测试脚本
- ✅ 文档

功能已准备就绪，可以开始使用！

