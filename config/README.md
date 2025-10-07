# AI API 配置说明

## 配置文件位置

API配置文件会自动保存在用户数据目录中：
- Windows: `%APPDATA%\emm-tool\ai_api_config.json`
- macOS: `~/Library/Application Support/emm-tool/ai_api_config.json`
- Linux: `~/.config/emm-tool/ai_api_config.json`

## 首次配置

1. 复制 `config/ai_api_config.json.template` 文件内容
2. 在应用首次运行后，配置文件会自动创建在用户数据目录
3. 编辑配置文件，填写你的API密钥和参数

## 配置示例

```json
{
  "provider": "qwen",
  "apiKey": "你的API密钥",
  "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
  "model": "qwen-max",
  "temperature": 0.3,
  "maxTokens": 2000
}
```

## 支持的AI服务商

- **qwen**: 阿里云通义千问 (推荐)
- **openai**: OpenAI GPT系列
- **openrouter**: OpenRouter (支持多种模型)
- **claude**: Anthropic Claude系列
- **ernie**: 百度文心一言

## 注意事项

- API密钥属于敏感信息，请勿分享或提交到代码仓库
- 配置文件会自动保存到用户数据目录，与应用数据文件放在一起
- 如需更换API服务商，只需修改 `provider` 和相应的 `apiKey`、`baseUrl` 即可
