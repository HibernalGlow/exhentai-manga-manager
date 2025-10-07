#!/usr/bin/env node
/**
 * 测试Google Gemini SDK集成
 */

const { GoogleGenAI } = require('@google/genai')

async function testGeminiIntegration() {
  console.log('🔄 测试Google Gemini SDK集成...')

  try {
    const apiKey = 'AIzaSyBkcYQyurTUArmy2tQST-zz36V8YEK4L40'
    const model = 'gemini-2.5-flash'

    console.log('📡 测试API连接...')
    const genAI = new GoogleGenAI({ apiKey })
    const response = await genAI.models.generateContent({
      model: model,
      contents: 'Hello, can you translate "Hello World" to Chinese?'
    })

    console.log('✅ API连接测试成功')
    console.log('📝 响应内容:', response.text)

    // 测试翻译功能
    console.log('\n� 测试翻译功能...')
    const translationPrompt = `请将以下漫画标题翻译成简洁的中文作品名。

英文标题: Kuroinu: Kedakaki Seijo wa Hakudaku ni Somaru
日文标题: 黒獣～高潔な聖女は白濁に染まる～
文件名: [Author] Kuroinu - Kedakaki Seijo wa Hakudaku ni Somaru

要求：
1. 只返回作品名，不包含展会信息、翻译者、汉化组等
2. 保持简洁自然的中文表达
3. 去除所有方括号、圆括号内的附加信息

请直接返回中文译名，不要任何解释：`

    const translationResponse = await genAI.models.generateContent({
      model: model,
      contents: translationPrompt
    })

    console.log('✅ 翻译测试成功')
    console.log('📝 翻译结果:', translationResponse.text.trim())

  } catch (error) {
    console.error('❌ 测试错误:', error.message)
    if (error.response) {
      console.error('响应状态:', error.response.status)
      console.error('响应数据:', error.response.data)
    }
  }
}

testGeminiIntegration()