/**
 * AI 自动标签功能
 * 通过 AI API 根据标题推断标签
 */

const { ipcMain, shell } = require('electron')
const fetch = require('node-fetch')
const fs = require('fs')
const path = require('path')

function registerAiTagHandlers(dependencies) {
  const { Manga: db } = dependencies
  
  console.log('🤖 注册 AI 标签处理器...')
  
  // 获取数据库中现有的标签列表（用于 AI 参考）
  ipcMain.handle('get-existing-tags', async (event, category) => {
    try {
      console.log(`📋 获取 ${category || '所有'} 类别的现有标签`)
      
      const books = await db.findAll({
        attributes: ['tags'],
        where: {
          status: 'tagged'
        },
        raw: true
      })
      
      // 统计所有标签
      const tagsByCategory = {}
      
      for (const book of books) {
        let tags = book.tags
        if (typeof tags === 'string') {
          tags = JSON.parse(tags)
        }
        
        if (!tags || typeof tags !== 'object') continue
        
        for (const [cat, tagList] of Object.entries(tags)) {
          // 如果指定了类别，只返回该类别
          if (category && cat !== category) continue
          
          if (!tagsByCategory[cat]) {
            tagsByCategory[cat] = new Set()
          }
          
          if (Array.isArray(tagList)) {
            tagList.forEach(tag => {
              if (tag && typeof tag === 'string') {
                tagsByCategory[cat].add(tag.trim())
              }
            })
          }
        }
      }
      
      // 转换为数组并排序
      const result = {}
      for (const [cat, tagSet] of Object.entries(tagsByCategory)) {
        result[cat] = Array.from(tagSet).sort((a, b) => 
          a.localeCompare(b, 'ja', { sensitivity: 'base' })
        )
      }
      
      // 统计数量
      const counts = {}
      for (const [cat, tags] of Object.entries(result)) {
        counts[cat] = tags.length
      }
      
      console.log(`✅ 标签统计:`, counts)
      
      return {
        success: true,
        tags: result,
        counts
      }
    } catch (error) {
      console.error('❌ 获取标签列表失败:', error)
      return {
        success: false,
        message: error.message
      }
    }
  })
  
  // AI 推断单本书的标签
  ipcMain.handle('ai-infer-tags', async (event, { bookId, title, apiConfig }) => {
    try {
      console.log(`🤖 AI 推断标签: ${title}`)
      
      // 获取现有标签列表（作为 AI 参考）
      const existingTags = await getExistingTagsForAI(db)
      
      // 调用 AI API
      const inferredTags = await callAiApi(title, existingTags, apiConfig)
      
      // 匹配和规范化标签
      const normalizedTags = await matchAndNormalizeTags(db, inferredTags)
      
      console.log(`✅ 推断结果:`, normalizedTags)
      
      // 如果不是测试，更新数据库
      if (bookId !== 'test') {
        const book = await db.findByPk(bookId, {
          attributes: ['id', 'tags'],
          raw: true
        })
        
        if (book) {
          const currentTags = typeof book.tags === 'string' ? JSON.parse(book.tags) : (book.tags || {})
          const mergedTags = mergeTags(currentTags, normalizedTags)
          
          await db.update(
            { tags: JSON.stringify(mergedTags), status: 'tagged' },
            { where: { id: bookId } }
          )
        }
      }
      
      return {
        success: true,
        tags: normalizedTags,
        raw: inferredTags
      }
    } catch (error) {
      console.error('❌ AI 推断失败:', error)
      return {
        success: false,
        message: error.message
      }
    }
  })
  
  // 批量 AI 推断标签
  ipcMain.handle('ai-batch-infer-tags', async (event, { bookIds, apiConfig, onProgress }) => {
    try {
      console.log(`🤖 批量 AI 推断，共 ${bookIds.length} 本书`)
      
      const results = []
      const errors = []
      
      // 获取现有标签列表（只获取一次）
      const existingTags = await getExistingTagsForAI(db)
      
      for (let i = 0; i < bookIds.length; i++) {
        const bookId = bookIds[i]
        
        try {
          // 获取书籍信息
          const book = await db.findByPk(bookId, {
            attributes: ['id', 'title', 'tags'],
            raw: true
          })
          
          if (!book) {
            errors.push({ bookId, error: '书籍不存在' })
            continue
          }
          
          // 调用 AI API
          const inferredTags = await callAiApi(book.title, existingTags, apiConfig)
          
          // 匹配和规范化标签
          const normalizedTags = await matchAndNormalizeTags(db, inferredTags)
          
          // 更新数据库
          const currentTags = typeof book.tags === 'string' ? JSON.parse(book.tags) : (book.tags || {})
          const mergedTags = mergeTags(currentTags, normalizedTags)
          
          await db.update(
            { tags: mergedTags },
            { where: { id: bookId } }
          )
          
          results.push({
            bookId,
            title: book.title,
            tags: normalizedTags
          })
          
          console.log(`✅ [${i + 1}/${bookIds.length}] ${book.title}`)
          
          // 进度回调
          if (onProgress) {
            onProgress({ current: i + 1, total: bookIds.length })
          }
          
          // 避免 API 限流
          await sleep(1000)
          
        } catch (error) {
          console.error(`❌ 处理书籍 ${bookId} 失败:`, error)
          errors.push({ bookId, error: error.message })
        }
      }
      
      return {
        success: true,
        results,
        errors,
        total: bookIds.length,
        successCount: results.length,
        errorCount: errors.length
      }
    } catch (error) {
      console.error('❌ 批量推断失败:', error)
      return {
        success: false,
        message: error.message
      }
    }
  })
  
  console.log('✅ AI 标签处理器注册完成')
}

/**
 * 获取现有标签列表（优化版，用于 AI 参考）
 * 只返回常用标签，避免列表过长
 */
async function getExistingTagsForAI(db) {
  const books = await db.findAll({
    attributes: ['tags'],
    where: {
      status: 'tagged'
    },
    raw: true
  })
  
  // 统计标签出现次数
  const tagCounts = {}
  
  for (const book of books) {
    let tags = book.tags
    if (typeof tags === 'string') {
      tags = JSON.parse(tags)
    }
    
    if (!tags || typeof tags !== 'object') continue
    
    for (const [category, tagList] of Object.entries(tags)) {
      if (!tagCounts[category]) {
        tagCounts[category] = {}
      }
      
      if (Array.isArray(tagList)) {
        tagList.forEach(tag => {
          if (tag && typeof tag === 'string') {
            const normalized = tag.trim()
            tagCounts[category][normalized] = (tagCounts[category][normalized] || 0) + 1
          }
        })
      }
    }
  }
  
  // 只返回出现次数 >= 3 的标签（常用标签）
  const result = {}
  for (const [category, counts] of Object.entries(tagCounts)) {
    result[category] = Object.entries(counts)
      .filter(([tag, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1]) // 按出现次数排序
      .slice(0, 200) // 每个类别最多 200 个
      .map(([tag]) => tag)
  }
  
  return result
}

/**
 * 调用 AI API 推断标签
 */
async function callAiApi(title, existingTags, apiConfig) {
  const { apiUrl, apiKey, model } = apiConfig
  
  console.log('🤖 AI API 配置:', {
    apiUrl,
    model,
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey ? apiKey.length : 0
  })
  
  // 构建提示词
  const prompt = buildPrompt(title, existingTags)
  
  console.log('📝 发送请求到:', apiUrl)
  
  // 调用 API（支持 OpenAI 兼容接口）
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: '你是一个专业的漫画标签分类助手。根据标题推断标签，只返回 JSON 格式。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    })
  })
  
  if (!response.ok) {
    throw new Error(`API 请求失败: ${response.status} ${response.statusText}`)
  }
  
  const data = await response.json()
  const content = data.choices[0].message.content
  
  // 解析 JSON
  return JSON.parse(content)
}

/**
 * 构建 AI 提示词
 */
function buildPrompt(title, existingTags) {
  const tagExamples = {}
  
  // 为每个类别提供示例（最多 50 个）
  for (const [category, tags] of Object.entries(existingTags)) {
    tagExamples[category] = tags.slice(0, 50)
  }
  
  return `请根据以下漫画标题推断标签：

标题：${title}

可选标签列表（请尽量从这些标签中选择）：
${JSON.stringify(tagExamples, null, 2)}

要求：
1. 返回 JSON 格式：{ "parody": [...], "character": [...], "artist": [...], "group": [...], "female": [...], "male": [...] }
2. 尽量从提供的标签列表中选择
3. 如果确定某个标签但列表中没有，可以添加新标签
4. 不确定的类别可以返回空数组
5. 标签名使用原文（日文/英文）

示例：
标题：(C96) [サークル名 (作者名)] キャラ名本 (原作名)
返回：{
  "parody": ["原作名"],
  "character": ["キャラ名"],
  "artist": ["作者名"],
  "group": ["サークル名"],
  "female": [],
  "male": []
}`
}

/**
 * 匹配和规范化标签
 * 将 AI 返回的标签与数据库现有标签进行模糊匹配
 */
async function matchAndNormalizeTags(db, inferredTags) {
  // 获取数据库中的所有标签
  const existingTags = await getExistingTagsForAI(db)
  
  const normalized = {}
  
  for (const [category, tags] of Object.entries(inferredTags)) {
    if (!Array.isArray(tags)) continue
    
    normalized[category] = []
    
    for (const tag of tags) {
      if (!tag || typeof tag !== 'string') continue
      
      const trimmed = tag.trim()
      if (!trimmed) continue
      
      // 尝试在现有标签中找到匹配
      const existingList = existingTags[category] || []
      const matched = findBestMatch(trimmed, existingList)
      
      normalized[category].push(matched || trimmed)
    }
  }
  
  return normalized
}

/**
 * 模糊匹配标签
 */
function findBestMatch(tag, existingTags) {
  const tagLower = tag.toLowerCase()
  
  // 1. 精确匹配（不区分大小写）
  for (const existing of existingTags) {
    if (existing.toLowerCase() === tagLower) {
      return existing
    }
  }
  
  // 2. 包含匹配
  for (const existing of existingTags) {
    if (existing.toLowerCase().includes(tagLower) || tagLower.includes(existing.toLowerCase())) {
      return existing
    }
  }
  
  // 3. 没有匹配，返回原标签
  return null
}

/**
 * 合并标签（保留现有标签，添加新标签）
 */
function mergeTags(currentTags, newTags) {
  const merged = { ...currentTags }
  
  for (const [category, tags] of Object.entries(newTags)) {
    if (!merged[category]) {
      merged[category] = []
    }
    
    // 去重合并
    const existingSet = new Set(merged[category])
    for (const tag of tags) {
      existingSet.add(tag)
    }
    
    merged[category] = Array.from(existingSet)
  }
  
  return merged
}

/**
 * 延迟函数
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

module.exports = {
  registerAiTagHandlers
}

