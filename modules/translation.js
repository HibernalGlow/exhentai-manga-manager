/**
 * Translation module for AI-powered Chinese translation of manga titles
 * 漫画标题AI中文翻译模块
 */

const path = require('path')
const fs = require('fs')
const { isPureNumberOrChinese } = require('./string_utils.js')
const OpenAI = require('openai')
const { GoogleGenAI } = require('@google/genai')

// 导入现成的URL分组排序函数
const { sortByUrlGroup } = require('./sqlFilter.js')

// 导入存储路径（与数据库等文件放在一起）
const { STORE_PATH } = require('./init_folder_setting.js')

// 导入翻译数据库模块
const {
  getTranslation,
  saveTranslation,
  hasTranslation,
  getTranslationsBatch,
  migrateFromJSON,
  TRANSLATION_DB_PATH
} = require('./translation_db.js')

// 旧的JSON文件路径（用于迁移）
const TRANSLATIONS_FILE = path.join(STORE_PATH, 'translations.json')


// API配置文件路径（保存到用户数据目录）
const API_CONFIG_FILE = path.join(STORE_PATH, 'ai_api_config.json')
let API_CONFIG = null

function loadApiConfig() {
  try {
    if (fs.existsSync(API_CONFIG_FILE)) {
      const data = fs.readFileSync(API_CONFIG_FILE, 'utf8')
      const configFile = JSON.parse(data)
      console.log('[API Config] Loaded from:', API_CONFIG_FILE)
      
      // 如果是新格式(带 providers 数组),提取当前激活的 provider
      if (configFile.providers && Array.isArray(configFile.providers)) {
        const activeIndex = configFile.activeIndex || 0
        const activeProvider = configFile.providers[activeIndex]
        
        console.log('[API Config] Config file structure:', {
          activeIndex: configFile.activeIndex,
          providersCount: configFile.providers.length,
          activeProviderName: activeProvider?.name
        })
        
        if (activeProvider) {
          API_CONFIG = {
            provider: activeProvider.provider,
            apiKey: activeProvider.apiKey,
            baseUrl: activeProvider.baseUrl,
            model: activeProvider.model,
            temperature: activeProvider.temperature || 0.3,
            maxTokens: activeProvider.maxTokens || 2000,
            timeout: activeProvider.timeout || 30
          }
          console.log('[API Config] Using active provider:', activeProvider.name || activeProvider.provider)
          console.log('[API Config] API_CONFIG set to:', {
            provider: API_CONFIG.provider,
            baseUrl: API_CONFIG.baseUrl,
            model: API_CONFIG.model
          })
          return configFile // 返回完整配置对象(用于IPC)
        }
      } else {
        // 旧格式,直接使用
        API_CONFIG = configFile
        return configFile
      }
    }
  } catch (e) {
    console.error('Failed to load API config:', e)
  }
  
  // 默认配置（提示用户填写）
  API_CONFIG = {
    provider: 'qwen',
    apiKey: '请填写你的API密钥',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-max',
    temperature: 0.3,
    maxTokens: 2000
  }
  
  // 自动创建默认配置文件
  try {
    fs.writeFileSync(API_CONFIG_FILE, JSON.stringify(API_CONFIG, null, 2), 'utf8')
    console.log('[API Config] Created default config at:', API_CONFIG_FILE)
  } catch (e) {
    console.error('[API Config] Failed to create default config:', e)
  }
  
  return API_CONFIG
}

/**
 * Save API configuration to file
 * 保存API配置到文件
 */
function saveApiConfig(config) {
  try {
    // 如果是新格式,也需要更新 API_CONFIG
    if (config.providers && Array.isArray(config.providers)) {
      const activeIndex = config.activeIndex || 0
      const activeProvider = config.providers[activeIndex]
      
      if (activeProvider) {
        API_CONFIG = {
          provider: activeProvider.provider,
          apiKey: activeProvider.apiKey,
          baseUrl: activeProvider.baseUrl,
          model: activeProvider.model,
          temperature: activeProvider.temperature || 0.3,
          maxTokens: activeProvider.maxTokens || 2000,
          timeout: activeProvider.timeout || 300
        }
        console.log('[API Config] Updated API_CONFIG from active provider:', activeProvider.provider)
      }
    } else {
      // 旧格式
      API_CONFIG = config
    }
    
    fs.writeFileSync(API_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8')
    console.log('[API Config] Saved to:', API_CONFIG_FILE)
    return true
  } catch (e) {
    console.error('[API Config] Failed to save:', e)
    throw e
  }
}

// 启动时加载一次
loadApiConfig()

/**
 * Update API configuration from settings
 * 从设置更新API配置
 */
function updateApiConfig(settings) {
  // 先从 config 文件加载
  loadApiConfig()
  
  console.log('[API Config] After loadApiConfig, API_CONFIG:', {
    provider: API_CONFIG.provider,
    model: API_CONFIG.model,
    baseUrl: API_CONFIG.baseUrl,
    apiKey: API_CONFIG.apiKey ? `${API_CONFIG.apiKey.substring(0, 10)}...` : 'MISSING'
  })
  
  // 用户设置优先覆盖
  if (settings) {
    if (settings.aiApiProvider) API_CONFIG.provider = settings.aiApiProvider
    if (settings.aiApiKey) API_CONFIG.apiKey = settings.aiApiKey
    if (settings.aiApiBaseUrl) API_CONFIG.baseUrl = settings.aiApiBaseUrl
    if (settings.aiModel) API_CONFIG.model = settings.aiModel
    if (settings.aiTemperature !== undefined) API_CONFIG.temperature = settings.aiTemperature
    if (settings.aiMaxTokens) API_CONFIG.maxTokens = settings.aiMaxTokens
    if (settings.aiTimeout !== undefined) API_CONFIG.timeout = settings.aiTimeout
    // Set base URL based on provider
    if (!settings.aiApiBaseUrl) {
      switch (settings.aiApiProvider) {
        case 'openrouter':
          API_CONFIG.baseUrl = 'https://openrouter.ai/api/v1'
          break
        case 'openai':
          API_CONFIG.baseUrl = 'https://api.openai.com/v1'
          break
        case 'claude':
          API_CONFIG.baseUrl = 'https://api.anthropic.com/v1'
          break
        case 'qwen':
          API_CONFIG.baseUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
          break
        case 'ernie':
          API_CONFIG.baseUrl = 'https://aip.baidubce.com/rpc/2.0'
          break
        case 'gemini':
          API_CONFIG.baseUrl = 'https://generativelanguage.googleapis.com'
          break
      }
    }
  }
}

/**
 * Load translations from database (for batch operations)
 * 从数据库加载翻译（用于批量操作）
 * @deprecated Use getTranslation() or hasTranslation() for individual queries
 */
async function loadTranslations(bookHashes) {
  try {
    if (bookHashes && bookHashes.length > 0) {
      // 批量查询
      return await getTranslationsBatch(bookHashes)
    }
    // 不推荐：加载所有翻译（仅用于兼容性）
    console.warn('[Translation] Loading all translations is deprecated')
    const { getAllTranslations } = require('./translation_db.js')
    const allTranslations = await getAllTranslations()
    const result = {}
    allTranslations.forEach(t => {
      result[t.hash] = t
    })
    return result
  } catch (e) {
    console.error('Failed to load translations:', e)
    return {}
  }
}

/**
 * Save translations to database
 * 保存翻译到数据库
 * @deprecated This function is no longer needed, use saveBookTranslation() instead
 */
function saveTranslations(translations) {
  console.warn('[Translation] saveTranslations() is deprecated, use saveBookTranslation() instead')
  // 不再实现，保留函数签名以防代码引用
}

/**
 * Get translation for a book
 * 获取书籍的翻译
 */
async function getBookTranslation(bookHash) {
  return await getTranslation(bookHash)
}

/**
 * Save translation for a book
 * 保存书籍的翻译
 */
async function saveBookTranslation(bookHash, translation) {
  await saveTranslation(bookHash, translation)
}

/**
 * Check if a filename should be excluded from translation
 * 检查文件名是否应该被排除在翻译之外
 */
function shouldExcludeFromTranslation(filename) {
  return isPureNumberOrChinese(filename)
}

/**
 * Batch translate multiple book titles in one API call
 * 在一次API调用中批量翻译多个书籍标题
 */

// 全局停止标志
let shouldStopTranslation = false

// 重置停止标志
function resetStopFlag() {
  shouldStopTranslation = false
}

// 设置停止标志
function stopTranslation() {
  shouldStopTranslation = true
}

async function translateBatchTitles(books) {
  if (!books || books.length === 0) {
    return []
  }

  // 构建批量翻译提示词
  const booksInfo = books.map((book, index) => {
    return `${index + 1}. 
   英文标题: ${book.title || '无'}
   日文标题: ${book.title_jpn || '无'}
   文件名: ${book.filename || '无'}`
  }).join('\n\n')

  const prompt = `请将以下${books.length}个漫画标题翻译成简洁的中文作品名。

${booksInfo}

要求：
1. 每个标题单独翻译，保持编号 给你的可能是罗马音日文中文英文混杂的作品名 翻译的时候不要只翻译为中文就好了 应该贴合原作二次元的人名用语
2. 只返回作品名，不包含展会信息、翻译者、汉化组等 但是不能过少 不能只翻译前面第一段的内容 翻译完整的作品名
3. 保持简洁自然的中文表达
4. 去除所有方括号、圆括号内的附加信息
5. 严格按照 "编号. 中文译名" 的格式返回

返回格式示例：
1. 某作品名
2. 另一作品名
3. 第三个作品名

请直接返回翻译结果，每行一个，不要任何额外解释：`

  // 添加重试机制（最多3次）
  const maxRetries = 3
  let lastError = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Translation] API call attempt ${attempt}/${maxRetries}`)
      console.log(`[Translation] Using provider: ${API_CONFIG.provider}`)
      console.log(`[Translation] Base URL: ${API_CONFIG.baseUrl}`)
      console.log(`[Translation] Model: ${API_CONFIG.model}`)
      
      let responseText = ''
      
      if (API_CONFIG.provider === 'gemini') {
        // 使用Google GenAI SDK
        console.log('[Translation] Using Google GenAI SDK...')
        const genAI = new GoogleGenAI({ apiKey: API_CONFIG.apiKey })
        const response = await genAI.models.generateContent({
          model: API_CONFIG.model,
          contents: prompt
        })
        
        if (response && response.text) {
          responseText = response.text.trim()
          console.log(`[Translation] Gemini API call succeeded on attempt ${attempt}`)
        } else {
          console.error('[Translation] Response.text is undefined')
          throw new Error('Response.text is undefined')
        }
      } else {
        // 使用 OpenAI SDK (兼容所有 OpenAI-compatible APIs)
        console.log('[Translation] Using OpenAI SDK...')
        const openai = new OpenAI({
          apiKey: API_CONFIG.apiKey,
          baseURL: API_CONFIG.baseUrl,
          timeout: (API_CONFIG.timeout || 30) * 1000,
          maxRetries: 0 // 我们自己处理重试
        })
        
        const completion = await openai.chat.completions.create({
          model: API_CONFIG.model,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: API_CONFIG.temperature || 0.3,
          max_tokens: Math.max(API_CONFIG.maxTokens || 2000, books.length * 50)
        })
        
        responseText = completion.choices[0].message.content.trim()
        console.log(`[Translation] OpenAI SDK call succeeded on attempt ${attempt}`)
      }

      // 解析返回的翻译结果
      const lines = responseText.split('\n').filter(line => line.trim())
      const translations = []

      for (let i = 0; i < books.length; i++) {
        const book = books[i]
        let chineseTitle = ''

        // 尝试匹配编号格式的翻译
        const pattern = new RegExp(`^${i + 1}\\.\\s*(.+)$`)
        const matchedLine = lines.find(line => pattern.test(line.trim()))

        if (matchedLine) {
          chineseTitle = matchedLine.replace(pattern, '$1').trim()
        } else if (lines[i]) {
          // 如果没有编号，按行号对应
          chineseTitle = lines[i].replace(/^\d+\.\s*/, '').trim()
        } else {
          // 如果解析失败，使用失败标记
          chineseTitle = '翻译失败'
        }

        // 清理引号
        chineseTitle = chineseTitle.replace(/^["'《]|["'》]$/g, '')

        translations.push({
          hash: book.hash,
          chinese_title: chineseTitle,
          original_english: book.title,
          original_japanese: book.title_jpn,
          filename: book.filename,
          fallback: false
        })
      }

      // 如果成功，返回翻译结果
      console.log(`[Translation] Translation completed successfully`)
      return translations

    } catch (error) {
      lastError = error
      console.error(`[Translation] API call attempt ${attempt}/${maxRetries} failed:`, error.message)
      
      // 如果是网络连接错误且还有重试机会，等待后重试
      if (error.code === 'ECONNRESET' && attempt < maxRetries) {
        const waitTime = attempt * 2000 // 递增等待时间：2s, 4s
        console.log(`[Translation] Retrying in ${waitTime / 1000}s...`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
        continue
      }
      
      // 其他错误或已达最大重试次数，跳出循环
      break
    }
  }

  // 所有重试都失败，返回失败标记（不使用原文）
  console.error(`[Translation] All ${maxRetries} attempts failed, marking as failed`)
  return books.map(book => ({
    hash: book.hash,
    chinese_title: '翻译失败', // 使用失败标记而不是原文
    original_english: book.title,
    original_japanese: book.title_jpn,
    filename: book.filename,
    fallback: true
  }))
}

/**
 * Clean title by removing brackets and extra info
 * 清理标题，移除方括号和额外信息
 */
function cleanTitle(title) {
  if (!title) return '未命名作品'
  
  return title
    .replace(/\[[^\]]*\]/g, '') // 移除方括号内容
    .replace(/【[^】]*】/g, '') // 移除双括号内容
    .replace(/（[^）]*）/g, '') // 移除小括号内容
    .replace(/\([^\)]*\)/g, '') // 移除英文括号内容
    .trim() || '未命名作品'
}

/**
 * Translate book title to Chinese using AI (single mode, for backward compatibility)
 * 使用AI将书籍标题翻译为中文（单条模式，保持向后兼容）
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

  try {
    let chineseTitle = ''
    
    if (API_CONFIG.provider === 'gemini') {
      // 使用Google GenAI SDK
      const genAI = new GoogleGenAI({ apiKey: API_CONFIG.apiKey })
      const response = await genAI.models.generateContent({
        model: API_CONFIG.model,
        contents: prompt
      })
      chineseTitle = response.text.trim()
    } else {
      // 使用 OpenAI SDK
      const openai = new OpenAI({
        apiKey: API_CONFIG.apiKey,
        baseURL: API_CONFIG.baseUrl,
        timeout: (API_CONFIG.timeout || 30) * 1000
      })
      
      const completion = await openai.chat.completions.create({
        model: API_CONFIG.model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: API_CONFIG.temperature || 0.3,
        max_tokens: API_CONFIG.maxTokens || 2000
      })
      
      chineseTitle = completion.choices[0].message.content.trim()
    }

    // 移除可能的引号包裹
    const cleanTitle = chineseTitle.replace(/^["'《]|["'》]$/g, '')

    return {
      chinese_title: cleanTitle,
      original_english: englishTitle,
      original_japanese: japaneseTitle,
      filename: filename
    }
  } catch (error) {
    console.error('AI translation error:', error)
    
    // 检查是否是限流错误
    if (error.message && error.message.includes('Rate limit exceeded')) {
      console.error('[Translation] ⚠️  Rate limit hit! Free model limit: 20 requests per minute.')
      console.error('[Translation] 💡 Suggestion: Wait a moment or consider using a paid API key.')
    }
    
    // 如果AI调用失败，返回失败标记（不使用原文）
    return {
      chinese_title: '翻译失败', // 使用失败标记而不是原文
      original_english: englishTitle,
      original_japanese: japaneseTitle,
      filename: filename,
      fallback: true // 标记使用了后备方案
    }
  }
}

/**
 * Test API connection with current configuration
 * 测试当前配置的API连接
 */
async function testApiConnection() {
  try {
    console.log('[API Test] Testing with provider:', API_CONFIG.provider)
    console.log('[API Test] Base URL:', API_CONFIG.baseUrl)
    console.log('[API Test] Model:', API_CONFIG.model)
    
    let responseContent = ''
    
    if (API_CONFIG.provider === 'gemini') {
      // 使用Google GenAI SDK
      const genAI = new GoogleGenAI({ apiKey: API_CONFIG.apiKey })
      const response = await genAI.models.generateContent({
        model: API_CONFIG.model,
        contents: 'Hello'
      })
      responseContent = response.text.trim()
    } else {
      // 使用 OpenAI SDK
      const openai = new OpenAI({
        apiKey: API_CONFIG.apiKey,
        baseURL: API_CONFIG.baseUrl,
        timeout: (API_CONFIG.timeout || 30) * 1000
      })
      
      const completion = await openai.chat.completions.create({
        model: API_CONFIG.model,
        messages: [
          {
            role: 'user',
            content: 'Hello'
          }
        ],
        temperature: 0.3,
        max_tokens: 10
      })
      
      responseContent = completion.choices[0].message.content.trim()
    }
    
    console.log('[API Test] Test successful, response:', responseContent)
    return {
      success: true,
      message: 'API连接测试成功',
      response: responseContent
    }
  } catch (error) {
    console.error('[API Test] Test failed:', error.message)
    return {
      success: false,
      message: error.message
    }
  }
}

/**
 * Batch translate books without Chinese translations
 * 批量翻译没有中文翻译的书籍
 */
async function batchTranslateBooks(books, settings, onProgress) {
  console.log(`[Translation Backend] Starting batch translation for ${books.length} books`)
  console.log(`[Translation Backend] Settings:`, {
    excludePureNumberChinese: settings.excludePureNumberChinese,
    trimTitleRegExp: settings.trimTitleRegExp,
    batchSize: settings.batchTranslationSize || 10,
    sorting: 'URL grouped (descending)',
    apiConfig: 'Loaded from ai_api_config.json'
  })
  
  // 重置停止标志
  resetStopFlag()
  
  // 首次运行时自动迁移JSON数据（如果存在）
  if (fs.existsSync(TRANSLATIONS_FILE)) {
    console.log('[Translation Backend] Detected old JSON file, migrating to database...')
    try {
      const migrationResult = await migrateFromJSON(TRANSLATIONS_FILE)
      console.log(`[Translation Backend] Migration complete: ${migrationResult.success} success, ${migrationResult.failed} failed`)
    } catch (e) {
      console.error('[Translation Backend] Migration failed:', e)
      console.log('[Translation Backend] Continuing with database...')
    }
  }
  
  // 批量查询已有翻译
  const bookHashes = books.map(b => b.hash)
  const translations = await getTranslationsBatch(bookHashes)
  
  const results = {
    success: 0,
    failed: 0,
    skipped: 0,
    errors: []
  }

  // 过滤需要翻译的书籍
  const booksToTranslate = []
  for (const book of books) {
    // 检查是否应该停止
    if (shouldStopTranslation) {
      console.log('[Translation Backend] Translation stopped by user')
      break
    }
    
    // 跳过已有翻译的
    if (translations[book.hash]) {
      console.log(`[Translation Backend] Skipped (already translated): ${book.filename}`)
      results.skipped++
      continue
    }

    // 检查是否需要排除（使用裁剪后的标题）
    if (settings.excludePureNumberChinese) {
      // 先裁剪标题（与 index.js 中的匹配逻辑一致）
      let trimmedTitle = book.filename
      if (settings.trimTitleRegExp) {
        try {
          trimmedTitle = trimmedTitle.replace(new RegExp(settings.trimTitleRegExp, 'g'), '').trim()
        } catch (e) {
          console.log(`[Translation Backend] trimTitleRegExp error for "${book.filename}":`, e.message)
        }
      }
      
      // 用裁剪后的标题判断是否排除
      if (shouldExcludeFromTranslation(trimmedTitle)) {
        console.log(`[Translation Backend] Skipped (excluded by filter): "${book.filename}" -> trimmed: "${trimmedTitle}"`)
        results.skipped++
        continue
      }
    }

    booksToTranslate.push(book)
  }

  console.log(`[Translation Backend] Books to translate: ${booksToTranslate.length}`)
  console.log(`[Translation Backend] Skipped: ${results.skipped} (already translated or excluded)`)
  
  // 如果没有需要翻译的书籍，直接返回
  if (booksToTranslate.length === 0) {
    console.log('[Translation Backend] No books to translate, all done!')
    return results
  }

  // URL分组并降序排序（使用现成的优化排序函数）
  const sortedBooks = sortByUrlGroup(booksToTranslate, false) // false = 降序
  console.log(`[Translation Backend] Books reordered by URL groups (descending) using optimized sort function`)

  // 计算批次大小（从设置中读取，默认 10）
  const BATCH_SIZE = settings.batchTranslationSize || 10
  console.log(`[Translation Backend] Batch size: ${BATCH_SIZE} books per request`)
  const batches = []
  
  for (let i = 0; i < sortedBooks.length; i += BATCH_SIZE) {
    batches.push(sortedBooks.slice(i, i + BATCH_SIZE))
  }

  console.log(`[Translation Backend] Split into ${batches.length} batches (${BATCH_SIZE} books per batch)`)

  // 逐批次翻译
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    // 检查是否应该停止
    if (shouldStopTranslation) {
      console.log('[Translation Backend] Translation stopped by user')
      break
    }
    
    const batch = batches[batchIndex]
    const batchStart = batchIndex * BATCH_SIZE + 1
    const batchEnd = Math.min(batchStart + batch.length - 1, sortedBooks.length)

    console.log(`\n[Translation Backend] 📦 Processing batch ${batchIndex + 1}/${batches.length} (books ${batchStart}-${batchEnd})`)
    console.log(`[Translation Backend] Batch books:`, batch.map(b => b.filename).join(', '))

    // 进度回调 - 使用正确的总数（需要翻译的书籍数量）
    if (onProgress) {
      onProgress({
        current: batchStart,
        total: booksToTranslate.length,  // 修复：使用需要翻译的数量，而不是总书籍数量
        book: batch[0]
      })
    }

    try {
      console.log(`[Translation Backend] 🚀 Calling batch translation API...`)
      const batchTranslations = await translateBatchTitles(batch)
      
      console.log(`[Translation Backend] ✅ Batch API returned ${batchTranslations.length} results`)

      // 保存翻译结果（只保存成功的翻译）
      for (let i = 0; i < batchTranslations.length; i++) {
        const translation = batchTranslations[i]
        const book = batch[i]

        if (translation.fallback) {
          console.log(`[Translation Backend] ⚠️  Failed (not saved): ${book.filename}`)
          results.failed++
          results.errors.push({
            book: book.filename,
            error: 'Translation failed, not saved'
          })
          // 不保存失败的翻译
        } else {
          console.log(`[Translation Backend] ✅ ${i + 1}/${batch.length}: ${book.filename} -> ${translation.chinese_title}`)
          results.success++
          await saveBookTranslation(book.hash, translation)
        }
      }

      // 批次间延迟（避免限流）
      if (batchIndex < batches.length - 1) {
        const waitTime = 500 // 3秒
        console.log(`[Translation Backend] ⏳ Waiting ${waitTime / 1000}s before next batch...`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }

    } catch (error) {
      console.error(`[Translation Backend] ❌ Batch ${batchIndex + 1} failed:`, error.message)
      
      // 批次失败时，尝试单条翻译（fallback）
      console.log(`[Translation Backend] 🔄 Falling back to single-item translation for this batch...`)
      
      for (const book of batch) {
        try {
          const translation = await translateTitleToChinese(
            book.title,
            book.title_jpn,
            book.filename
          )
          
          if (translation.fallback) {
            console.log(`[Translation Backend] ⚠️  Failed (not saved): ${book.filename}`)
            results.failed++
            // 不保存失败的翻译
          } else {
            console.log(`[Translation Backend] ✅ ${book.filename} -> ${translation.chinese_title}`)
            results.success++
            await saveBookTranslation(book.hash, translation)
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000))
          
        } catch (singleError) {
          console.error(`[Translation Backend] ❌ Single translation failed: ${book.filename}`)
          results.failed++
          results.errors.push({
            book: book.filename,
            error: singleError.message
          })
        }
      }
    }
  }

  // console.log(`\n[Translation Backend] 🎉 Batch translation completed:`, results)
  console.log(`[Translation Backend] Speed: ${booksToTranslate.length} books in ${batches.length} API calls (avg ${(booksToTranslate.length / batches.length).toFixed(1)} books/call)`)
  
  return results
}

/**
 * Initialize translation IPC handlers
 * 初始化翻译相关的IPC处理器
 */
function initTranslationIPC(ipcMain, getSettings) {
  // 获取API配置
  ipcMain.handle('get-api-config', async () => {
    return loadApiConfig()
  })

  // 保存API配置
  ipcMain.handle('save-api-config', async (event, config) => {
    try {
      saveApiConfig(config)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // 获取书籍翻译
  ipcMain.handle('get-book-translation', async (event, bookHash) => {
    return await getBookTranslation(bookHash)
  })

  // 保存书籍翻译
  ipcMain.handle('save-book-translation', async (event, { bookHash, translation }) => {
    await saveBookTranslation(bookHash, translation)
    return true
  })

  // AI 翻译标题
  ipcMain.handle('translate-title-ai', async (event, { englishTitle, japaneseTitle, filename }) => {
    // 直接从 JSON 配置文件加载，不使用 settings 覆盖
    loadApiConfig()
    console.log('[Translation IPC] Single title translation using config from JSON file')
    
    return await translateTitleToChinese(englishTitle, japaneseTitle, filename)
  })

  // 测试API连接
  ipcMain.handle('test-translation-api', async (event) => {
    // 直接从 JSON 配置文件加载，不使用 settings 覆盖
    loadApiConfig()
    console.log('[Translation IPC] Testing API with config from JSON file')
    
    return await testApiConnection()
  })

  // 批量翻译书籍
  ipcMain.handle('batch-translate-books', async (event, { books, settings }) => {
    try {
      console.log(`[Translation IPC] Received batch translate request for ${books.length} books`)
      
      // 直接从 JSON 配置文件加载，不使用 settings 覆盖
      loadApiConfig()
      console.log(`[Translation IPC] API config loaded from JSON:`, {
        provider: API_CONFIG.provider,
        model: API_CONFIG.model,
        baseUrl: API_CONFIG.baseUrl
      })
      
      // 批量翻译，发送进度更新
      const result = await batchTranslateBooks(books, settings, (progress) => {
        console.log(`[Translation IPC] Progress: ${progress.current}/${progress.total}`)
        event.sender.send('batch-translate-progress', progress)
      })
      
      // console.log(`[Translation IPC] Batch translate completed:`, result)
      return result
    } catch (error) {
      console.error(`[Translation IPC] Batch translate error:`, error)
      throw error
    }
  })
  
  // 停止批量翻译
  ipcMain.handle('stop-batch-translation', async () => {
    console.log('[Translation IPC] Received stop translation request')
    stopTranslation()
    return { success: true }
  })
}

module.exports = {
  loadTranslations,
  saveTranslations,
  getBookTranslation,
  saveBookTranslation,
  shouldExcludeFromTranslation,
  translateTitleToChinese,
  translateBatchTitles,
  cleanTitle,
  updateApiConfig,
  loadApiConfig,
  saveApiConfig,
  testApiConnection,
  batchTranslateBooks,
  initTranslationIPC
}