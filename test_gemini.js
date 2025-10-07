#!/usr/bin/env node
/**
 * 测试Google Gemini API连接
 */

const fetch = require('node-fetch')

async function testGeminiAPI() {
  const config = {
    provider: 'gemini',
    apiKey: 'AIzaSyBkcYQyurTUArmy2tQST-zz36V8YEK4L40',
    baseUrl: 'https://generativelanguage.googleapis.com',
    model: 'gemini-2.5-flash',
    temperature: 0.3,
    maxTokens: 2000
  }

  console.log('🔄 测试Google Gemini API文本生成...')
  console.log('配置:', {
    provider: config.provider,
    model: config.model,
    baseUrl: config.baseUrl
  })

  try {
    // 使用原生API格式进行文本生成
    const generateResponse = await fetch(`${config.baseUrl}/models/${config.model}:generateContent?key=${config.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: '翻译"Hello"到中文'
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 100
        }
      })
    })

    console.log('📡 生成请求HTTP状态:', generateResponse.status)

    if (generateResponse.ok) {
      const generateData = await generateResponse.json()
      console.log('📦 生成响应:', JSON.stringify(generateData, null, 2))

      if (generateData.candidates && generateData.candidates[0] && generateData.candidates[0].content && generateData.candidates[0].content.parts && generateData.candidates[0].content.parts[0]) {
        const content = generateData.candidates[0].content.parts[0].text.trim()
        console.log('✅ 成功获取响应内容:', content)
      } else {
        console.error('❌ 响应格式不符合预期')
      }
    } else {
      const errorData = await generateResponse.json().catch(() => ({}))
      console.error('❌ 生成请求失败:', errorData)
    }

  } catch (error) {
    console.error('❌ 网络或解析错误:', error.message)
  }
}

testGeminiAPI()