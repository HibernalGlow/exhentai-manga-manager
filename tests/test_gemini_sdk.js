#!/usr/bin/env node
/**
 * 测试Google GenAI SDK
 */

const { GoogleGenAI } = require('@google/genai')

async function testGeminiSDK() {
  const apiKey = 'AIzaSyBkcYQyurTUArmy2tQST-zz36V8YEK4L40'
  
  console.log('🔄 测试Google GenAI SDK...')

  try {
    const genAI = new GoogleGenAI({ apiKey })
    
    console.log('📤 发送请求...')
    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: '请将漫画标题 "Kuroinu: Kedakaki Seijo wa Hakudaku ni Somaru" 翻译成中文作品名，只返回作品名，不要其他内容。'
    })
    
    console.log('📥 收到响应...')
    console.log('✅ 成功获取响应:', response.text)
    
  } catch (error) {
    console.error('❌ SDK错误:', error.message)
    if (error.code) {
      console.error('错误代码:', error.code)
    }
  }
}

testGeminiSDK()