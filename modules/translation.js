/**
 * Translation module for AI-powered Chinese translation of manga titles
 * 漫画标题AI中文翻译模块
 */

const path = require('path')
const fs = require('fs')
const { isPureNumberOrChinese } = require('./string_utils.js')

// 翻译存储文件路径
const TRANSLATIONS_FILE = path.join(__dirname, '..', 'translations.json')

/**
 * Load translations from JSON file
 * 从JSON文件加载翻译
 */
function loadTranslations() {
  try {
    if (fs.existsSync(TRANSLATIONS_FILE)) {
      const data = fs.readFileSync(TRANSLATIONS_FILE, 'utf8')
      return JSON.parse(data)
    }
  } catch (e) {
    console.error('Failed to load translations:', e)
  }
  return {}
}

/**
 * Save translations to JSON file
 * 保存翻译到JSON文件
 */
function saveTranslations(translations) {
  try {
    fs.writeFileSync(TRANSLATIONS_FILE, JSON.stringify(translations, null, 2), 'utf8')
  } catch (e) {
    console.error('Failed to save translations:', e)
    throw e
  }
}

/**
 * Get translation for a book
 * 获取书籍的翻译
 */
function getBookTranslation(bookHash) {
  const translations = loadTranslations()
  return translations[bookHash] || null
}

/**
 * Save translation for a book
 * 保存书籍的翻译
 */
function saveBookTranslation(bookHash, translation) {
  const translations = loadTranslations()
  translations[bookHash] = {
    ...translation,
    last_updated: new Date().toISOString()
  }
  saveTranslations(translations)
}

/**
 * Check if a filename should be excluded from translation
 * 检查文件名是否应该被排除在翻译之外
 */
function shouldExcludeFromTranslation(filename) {
  return isPureNumberOrChinese(filename)
}

/**
 * Translate book title to Chinese using AI
 * 使用AI将书籍标题翻译为中文
 */
async function translateTitleToChinese(englishTitle, japaneseTitle, filename) {
  // 检查是否应该排除翻译
  if (shouldExcludeFromTranslation(filename)) {
    throw new Error('Filename contains only numbers or Chinese characters, skipping translation')
  }

  // 构建提示词
  const prompt = `请将以下漫画标题翻译成简洁的中文作品名（不包含展会时间、翻译者、汉化组等信息，只保留最核心的作品名）：

英文标题: ${englishTitle || '无'}
日文标题: ${japaneseTitle || '无'}
文件名: ${filename || '无'}

要求：
1. 只返回作品名，不要其他内容
2. 保持简洁，不要添加多余信息
3. 如果是系列作品，保留系列名
4. 中文翻译要自然流畅
5. 去除所有展会信息（如[C97]、[COMIC1☆15]等）
6. 去除翻译者信息（如[中文]、[汉化]等）

请直接返回中文译名，不要任何解释：`

  // 这里可以集成各种 AI API，比如：
  // - OpenAI GPT
  // - Claude
  // - 通义千问
  // - 文心一言
  // - 等等

  // 示例：使用 OpenAI API（需要配置 API key）
  /*
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 100,
      temperature: 0.3
    })
  })

  const data = await response.json()
  const chineseTitle = data.choices[0].message.content.trim()
  */

  // 示例：使用通义千问 API
  /*
  const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DASHSCOPE_API_KEY}`,
      'X-DashScope-SSE': 'disable'
    },
    body: JSON.stringify({
      model: 'qwen-turbo',
      input: { messages: [{ role: 'user', content: prompt }] },
      parameters: { max_tokens: 100, temperature: 0.3 }
    })
  })

  const data = await response.json()
  const chineseTitle = data.output.text.trim()
  */

  // 临时模拟实现 - 实际部署时需要替换为真实的 AI API 调用
  let chineseTitle = ''

  // 简单的规则-based 翻译（仅用于演示）
  if (japaneseTitle) {
    // 移除常见的展会信息
    let cleanTitle = japaneseTitle
      .replace(/\[[^\]]*\]/g, '') // 移除方括号内容
      .replace(/【[^】]*】/g, '') // 移除双括号内容
      .replace(/（[^）]*）/g, '') // 移除小括号内容
      .replace(/\([^\)]*\)/g, '') // 移除英文括号内容
      .trim()

    // 这里应该调用真实的 AI API
    chineseTitle = `《${cleanTitle}》` // 临时模拟
  } else if (englishTitle) {
    let cleanTitle = englishTitle
      .replace(/\[[^\]]*\]/g, '')
      .replace(/【[^】]*】/g, '')
      .replace(/（[^）]*）/g, '')
      .replace(/\([^\)]*\)/g, '')
      .trim()

    chineseTitle = `《${cleanTitle}》` // 临时模拟
  } else {
    chineseTitle = '未命名作品'
  }

  return {
    chinese_title: chineseTitle,
    original_english: englishTitle,
    original_japanese: japaneseTitle,
    filename: filename
  }
}

/**
 * Initialize translation IPC handlers
 * 初始化翻译相关的IPC处理器
 */
function initTranslationIPC(ipcMain) {
  // 获取书籍翻译
  ipcMain.handle('get-book-translation', async (event, bookHash) => {
    return getBookTranslation(bookHash)
  })

  // 保存书籍翻译
  ipcMain.handle('save-book-translation', async (event, { bookHash, translation }) => {
    saveBookTranslation(bookHash, translation)
    return true
  })

  // AI 翻译标题
  ipcMain.handle('translate-title-ai', async (event, { englishTitle, japaneseTitle, filename }) => {
    return await translateTitleToChinese(englishTitle, japaneseTitle, filename)
  })
}

module.exports = {
  loadTranslations,
  saveTranslations,
  getBookTranslation,
  saveBookTranslation,
  shouldExcludeFromTranslation,
  translateTitleToChinese,
  initTranslationIPC
}