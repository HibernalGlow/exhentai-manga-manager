#!/usr/bin/env node
/**
 * 测试千问 API (使用 OpenAI SDK)
 */

const OpenAI = require('openai')

async function testQwenSDK() {
  const config = {
    apiKey: 'sk-35536bd065b849468e87577b8dc98e57',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-max'
  }

  console.log('🔄 测试千问 API (使用 OpenAI SDK)...')
  console.log('配置:', {
    model: config.model,
    baseURL: config.baseURL
  })

  try {
    const openai = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      timeout: 30000
    })
    
    console.log('📤 发送请求...')
    const completion = await openai.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: 'user',
          content: '请将漫画标题 "Kuroinu: Kedakaki Seijo wa Hakudaku ni Somaru" 翻译成中文作品名，只返回作品名，不要其他内容。'
        }
      ],
      temperature: 0.3,
      max_tokens: 100
    })
    
    const response = completion.choices[0].message.content.trim()
    console.log('📥 收到响应...')
    console.log('✅ 翻译结果:', response)
    
  } catch (error) {
    console.error('❌ SDK错误:', error.message)
    if (error.status) {
      console.error('HTTP状态码:', error.status)
    }
    if (error.code) {
      console.error('错误代码:', error.code)
    }
  }
}

testQwenSDK()
