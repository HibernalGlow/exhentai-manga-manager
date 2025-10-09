/**
 * SQLite Import Module for EhViewer/ExHentai Metadata
 * SQLite 导入模块：用于从 EhViewer 数据库导入元数据
 */

const path = require('path')
const _ = require('lodash')
const { 
  normalizeString, 
  calculateSimilarity,
  generateVariants
} = require('./string_utils')

/**
 * 验证关键词是否有效（只允许中文和日文字符，且不是通用名称）
 * @param {string} keyword - 关键词
 * @returns {boolean} 是否有效
 */
function isValidKeyword(keyword) {
  if (!keyword || keyword.length < 2) return false
  // 不允许纯数字关键词
  if (/^\d+(\.\d+)?$/.test(keyword.trim())) return false
  // 只允许包含中文或日文字符的关键词
  // 中文: \u4e00-\u9fff (CJK统一表意文字)
  // 日文平假名: \u3040-\u309f
  // 日文片假名: \u30a0-\u30ff
  // 日文汉字: \u4e00-\u9fff (与中文重叠)
  const chineseJapaneseRegex = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/
  if (!chineseJapaneseRegex.test(keyword)) return false

  // 过滤掉常见的通用名称和太短的关键词
  // 这些关键词太通用，会匹配到大量不相关的标题
  const commonNames = ['酱', '妹', '姐', '妹子', '姐姐', '妹妹', '老婆', '媳妇', '老婆子', '小妹', '小姐姐', '大姐姐', '小妹妹']
  // 检查关键词是否包含通用名称
  const containsCommonName = commonNames.some(name => keyword.includes(name))
  if (containsCommonName || keyword.length <= 2) return false

  // 对于3-4个字符的关键词，只有包含系列标识符的才有效
  if (keyword.length <= 4 && !/\b(vol|volume|第|code|episode|chapter|part|～|~|no\.?|number|#|酱|妹|姐)\b/i.test(keyword)) {
    return false
  }

  return true
}

/**
 * 去除英文、数字和符号，只保留中文和日文字符
 * @param {string} text - 原始文本
 * @returns {string} 清理后的文本
 */
function removeEnglishNumbersSymbols(text) {
  if (!text) return text
  // 保留中文、日文字符，移除英文、数字、符号
  // 中文: \u4e00-\u9fff (CJK统一表意文字)
  // 日文平假名: \u3040-\u309f
  // 日文片假名: \u30a0-\u30ff
  // 日文汉字: \u4e00-\u9fff (与中文重叠)
  // 空格: \s
  const chineseJapaneseRegex = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\s]/
  return text.split('').filter(char => chineseJapaneseRegex.test(char)).join('').trim()
}

/**
 * Build title index for fast matching
 * 构建标题索引以加速          console.log(`[关键词预筛选] ❌ 匹配失败: 所有候选项相似度均低于阈值 ${MIN_SIM                  console.log(`[关键词预筛选] 尝试前60%关键词: "${partialKeyword}" (原关键词: "${keyword}")`)
          
          // 用前60%关键词重新筛选
          const partialCandidates = []
          for (const title of titleArray) {
            if (title.includes(partialKeyword)) {
              partialCandidates.push(title)
            }
          }
          
          console.log(`[关键词预筛选] 前60%关键词筛选结果: ${partialCandidates.length} 个候选`)键词的前60%重新匹配（如果大于一个字，且不是英文标题）
        const keywordLength = keyword.length
        const partialLength = Math.floor(keywordLength * 0.6)
        if (partialLength > 1 && !isPrimarilyEnglish(keyword)) { // 确保大于一个字且不是英文ITY_FALLBACK}`)
          
          // 回退策略：使用关键词的前60%重新匹配（如果大于一个字，且不是英文标题）
          const keywordLength = keyword.length
          const partialLength = Math.floor(keywordLength * 0.6)
          if (partialLength > 1 && !isPrimarilyEnglish(keyword)) { // 确保大于一个字且不是英文
            const partialKeyword = keyword.substring(0, partialLength)
            console.log(`[关键词预筛选] 尝试前60%关键词: "${partialKeyword}" (原关键词: "${keyword}")`)param {Array} allTitles - Array of gallery records from database
 * @param {boolean} hasHashColumn - Whether the database has a hash column
 * @returns {Object} Index object with titleMap, titleArray, and hashIndex
 */
function buildTitleIndex(allTitles, hasHashColumn) {
  const titleMap = new Map() // 完整标题 -> [{gid, token, hash}]
  const titleArray = [] // 所有标题的数组（用于线性搜索备用）
  const hashIndex = hasHashColumn ? new Map() : null // hash -> [{gid, token}]
  
  for (const item of allTitles) {
    // 归一化标题：全角转半角 + 转小写
    const title = normalizeString(item.title || '').toLowerCase()
    const titleJpn = normalizeString(item.title_jpn || '').toLowerCase()
    const key = { gid: item.gid, token: item.token, hash: item.hash || null }
    
    // 建立完整标题索引
    if (title) {
      if (!titleMap.has(title)) {
        titleMap.set(title, [])
        titleArray.push(title)
      }
      titleMap.get(title).push(key)
    }
    
    if (titleJpn && titleJpn !== title) {
      if (!titleMap.has(titleJpn)) {
        titleMap.set(titleJpn, [])
        titleArray.push(titleJpn)
      }
      titleMap.get(titleJpn).push(key)
    }
    
    // 建立 hash 索引（最高优先级）
    if (hashIndex && key.hash) {
      if (!hashIndex.has(key.hash)) {
        hashIndex.set(key.hash, [])
      }
      hashIndex.get(key.hash).push({ gid: item.gid, token: item.token })
    }
  }
  
  return { titleMap, titleArray, hashIndex }
}

/**
 * Quick linear search for a single search term (used for original title only)
 * 快速线性搜索单个搜索词（仅用于原标题）
 * @param {string} searchTerm - Single normalized search term
 * @param {Object} titleMap - Title map from buildTitleIndex
 * @param {Array} titleArray - Title array from buildTitleIndex
 * @param {string} originalFilename - Original filename for similarity check
 * @returns {Array|null} Array of matching keys or null if not found
 */
async function quickLinearSearch(searchTerm, titleMap, titleArray, originalFilename) {
  const CHUNK_SIZE = 1000
  
  // 动态相似度阈值：短搜索词需要更高相似度
  // 短词(<=4字符)容易误匹配,需要0.5以上相似度
  // 长词(>4字符)可以接受0.3以上相似度
  const searchLength = searchTerm.replace(/\s+/g, '').length // 去除空格后的长度
  const MIN_SIMILARITY = searchLength <= 4 ? 0.5 : 0.3
  
  let bestMatch = null
  let bestSimilarity = 0
  
  for (let i = 0; i < titleArray.length; i++) {
    const title = titleArray[i]
    
    // 包含匹配 + 相似度验证
    if (title.includes(searchTerm)) {
      // 特殊情况1：如果标题以搜索词开头(前缀匹配)，认为是强匹配
      // 例如: "温泉" 匹配 "温泉 [AI Generated]"
      if (title.startsWith(searchTerm) || title.startsWith(searchTerm + ' ')) {
        return titleMap.get(title)
      }
      
      // 特殊情况2：如果搜索词占标题长度的50%以上，认为是强匹配
      const searchRatio = searchTerm.length / title.length
      if (searchRatio >= 0.5) {
        return titleMap.get(title)
      }
      
      // 否则计算相似度，确保匹配质量
      const similarity = calculateSimilarity(originalFilename, title)
      
      // 只保留相似度最高且超过阈值的匹配
      if (similarity >= MIN_SIMILARITY && similarity > bestSimilarity) {
        bestSimilarity = similarity
        bestMatch = titleMap.get(title)
      }
    }
    
    // 每处理 CHUNK_SIZE 条记录，让出事件循环
    if (i % CHUNK_SIZE === 0 && i > 0) {
      await new Promise(resolve => setImmediate(resolve))
    }
  }
  
  return bestMatch
}

/**
 * Find matches using title index with optimized search strategy and fuzzy variants
 * 使用标题索引查找匹配项（优化搜索策略 + 模糊变体）
 * @param {string} searchTerm - Normalized search term
 * @param {string} originalFilename - Original filename for similarity calculation
 * @param {Object} titleMap - Title map from buildTitleIndex
 * @param {Array} titleArray - Title array from buildTitleIndex
 * @returns {Array} Array of matching keys {gid, token, hash}
 */
async function findMatchesByTitle(searchTerm, originalFilename, titleMap, titleArray, source = 'unknown') {
  let foundKeys = []
  
  // 移除长度限制，允许短标题匹配
  // 像 "本能"、"雌吹"、"無題" 这样的短标题也应该能够匹配
  
  // 优化策略: 先用原标题直接匹配，不行再生成变体
  // 这样可以避免大部分情况下的不必要字符串转换
  
  // 步骤1: 尝试原标题精确匹配（最快，O(1)）
  const normalizedOriginal = normalizeString(searchTerm).toLowerCase()
  const exactMatch = titleMap.get(normalizedOriginal)
  if (exactMatch) {
    return exactMatch
  }
  
  // 步骤1.5: 分组匹配策略 - 先整体匹配，再逐步回退到前x个词
  const words = normalizedOriginal.split(/\s+/).filter(word => word.length > 0)
  if (words.length > 1) {
    // 从完整词组开始，逐步减少词数
    for (let i = words.length; i >= 2; i--) {
      const partialPhrase = words.slice(0, i).join(' ')
      const groupMatch = titleMap.get(partialPhrase)
      if (groupMatch) {
        console.log(`[分组匹配] 匹配成功: "${partialPhrase}" (前${i}个词)`)
        return groupMatch
      }
    }
  }
  
  // 步骤2: 尝试原标题模糊匹配（线性搜索但只用一个变体）
  if (titleArray && titleArray.length > 0) {
    const quickMatch = await quickLinearSearch(normalizedOriginal, titleMap, titleArray, originalFilename)
    if (quickMatch) {
      return quickMatch
    }
  }
  
  // 步骤3: 原标题匹配失败，生成所有变体再尝试
  const searchVariants = generateVariants(searchTerm)
  
  // 策略1: 先尝试精确匹配所有变体（O(1)）
  for (const variant of searchVariants) {
    const exactMatch = titleMap.get(variant)
    if (exactMatch) {
      return exactMatch
    }
  }
  
  // 策略1.5: 对变体进行分组匹配
  for (const variant of searchVariants) {
    const variantWords = variant.split(/\s+/).filter(word => word.length > 0)
    if (variantWords.length > 1) {
      // 从完整词组开始，逐步减少词数
      for (let i = variantWords.length; i >= 2; i--) {
        const partialPhrase = variantWords.slice(0, i).join(' ')
        const groupMatch = titleMap.get(partialPhrase)
        if (groupMatch) {
          console.log(`[变体分组匹配] 匹配成功: "${partialPhrase}" (变体: ${variant}, 前${i}个词)`)
          return groupMatch
        }
      }
    }
  }
  
  // 策略2: 使用所有变体进行线性搜索，收集所有匹配项
  if (titleArray && titleArray.length > 0) {
    const matchedTitles = [] // 存储所有匹配的标题
    const originalNormalized = normalizeString(originalFilename).toLowerCase()
    
    // 分块处理，避免阻塞事件循环
    const CHUNK_SIZE = 1000
    for (let i = 0; i < titleArray.length; i++) {
      const title = titleArray[i]
      
      // 尝试所有变体进行匹配
      let matched = false
      let matchedVariant = ''
      for (const variant of searchVariants) {
        if (title.includes(variant)) {
          matched = true
          matchedVariant = variant
          break
        }
      }
      
      if (matched) {
        // 特殊情况1：如果标题以变体开头(前缀匹配)
        if (title.startsWith(matchedVariant) || title.startsWith(matchedVariant + ' ')) {
          const keys = titleMap.get(title)
          if (keys) {
            const similarity = calculateSimilarity(originalNormalized, title)
            matchedTitles.push({ title, keys, similarity })
          }
        }
        // 特殊情况2：如果变体占标题长度的50%以上，认为是强匹配
        else if (matchedVariant.length / title.length >= 0.5) {
          const keys = titleMap.get(title)
          if (keys) {
            const similarity = calculateSimilarity(originalNormalized, title)
            matchedTitles.push({ title, keys, similarity })
          }
        } else {
          // 动态相似度阈值：短变体需要更高相似度
          const variantLength = matchedVariant.replace(/\s+/g, '').length
          const MIN_SIMILARITY = variantLength <= 4 ? 0.6 : 0.4
          
          // 计算相似度，过滤掉不相关的匹配
          const similarity = calculateSimilarity(originalNormalized, title)
          if (similarity >= MIN_SIMILARITY) {
            const keys = titleMap.get(title)
            if (keys) {
              matchedTitles.push({ title, keys, similarity })
            }
          }
        }
      }
      
      // 每处理 CHUNK_SIZE 条记录，让出事件循环
      if (i % CHUNK_SIZE === 0 && i > 0) {
        await new Promise(resolve => setImmediate(resolve))
      }
    }
    
    // 如果找到多个匹配，使用相似度排序
    if (matchedTitles.length > 0) {
      if (matchedTitles.length === 1) {
        return matchedTitles[0].keys
      } else {
        // 多个匹配，按相似度降序排序（相似度已在上面计算）
        matchedTitles.sort((a, b) => b.similarity - a.similarity)
        
        return matchedTitles[0].keys
      }
    }
  }
  
  // 策略3 (最终变体): 使用第一个空格前的关键词预筛选，再计算相似度
  // 大大减少需要比较相似度的数据量
  // 例如: "博士の研究 2 上 巫女たちの堕落" -> 提取 "博士の研究" 作为关键词
  if (titleArray && titleArray.length > 0) {
    const originalNormalized = normalizeString(originalFilename).toLowerCase()
    
    // 从裁剪后的标题 (searchTerm) 提取关键词，而不是原始文件名
    const searchTermNormalized = normalizeString(searchTerm).toLowerCase()
    
    // 智能提取关键词，针对系列作品优化
    const keyword = extractSmartKeyword(searchTermNormalized)
    
    // 如果关键词太短（少于2个字符）或无效（纯数字或非中文日文），跳过此策略
    if (keyword.length >= 2 && !/^\d+(\.\d+)?$/.test(keyword.trim()) && isValidKeyword(keyword)) {
      // console.log(`\n[关键词预筛选] 原始文件: ${originalFilename}`)
      // console.log(`[关键词预筛选] 裁剪标题: "${searchTerm}"`)
      console.log(`[关键词预筛选][${source}] 提取关键词: "${keyword}"`)
      
      // 预筛选：只保留包含关键词的标题
      const candidates = []
      for (const title of titleArray) {
        if (title.includes(keyword)) {
          candidates.push(title)
        }
      }
      
      console.log(`[关键词预筛选] 数据库总量: ${titleArray.length} -> 筛选后候选: ${candidates.length}`)
      
      // 对筛选后的候选标题计算相似度
      if (candidates.length > 0) {
        // 动态相似度阈值：根据候选数量和关键词类型调整
        // 候选越少 = 关键词越精准 = 可以用更低的阈值
        // 候选越多 = 关键词太泛 = 需要更高的阈值避免误匹配
        // 只有真正的系列关键词才可以使用较低的阈值
        let MIN_SIMILARITY_FALLBACK
        const isSeriesKeyword = /\b(vol|volume|第|code|episode|chapter|part|～|~|afterstory|side story|外伝|no\.?|number|#)\b/i.test(keyword)
        const isLongKeyword = keyword.length > 8 // 长关键词通常是系列标题
        const isPopularSeries = candidates.length > 50 && isSeriesKeyword // 只有系列关键词且候选很多时才认为是热门系列
        const isJapaneseSeries = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(keyword) && isSeriesKeyword // 日文关键词且是系列

        if (candidates.length <= 5) {
          MIN_SIMILARITY_FALLBACK = (isSeriesKeyword || isLongKeyword) ? 0.25 : 0.4
        } else if (candidates.length <= 20) {
          MIN_SIMILARITY_FALLBACK = (isSeriesKeyword || isLongKeyword) ? 0.35 : 0.5
        } else if (candidates.length <= 100) {
          MIN_SIMILARITY_FALLBACK = (isSeriesKeyword || isLongKeyword || isPopularSeries || isJapaneseSeries) ? 0.4 : 0.7
        } else if (candidates.length <= 500) {
          MIN_SIMILARITY_FALLBACK = (isSeriesKeyword || isLongKeyword || isPopularSeries || isJapaneseSeries) ? 0.45 : 0.8
        } else {
          MIN_SIMILARITY_FALLBACK = (isSeriesKeyword || isLongKeyword || isPopularSeries || isJapaneseSeries) ? 0.5 : 0.85
        }
        
        console.log(`[关键词预筛选] 动态阈值: ${MIN_SIMILARITY_FALLBACK} (基于候选数: ${candidates.length})`)
        
        let bestMatch = null
        let bestSimilarity = 0
        let bestTitle = ''
        
        for (const title of candidates) {
          const similarity = calculateSimilarity(originalNormalized, title)
          
          if (similarity >= MIN_SIMILARITY_FALLBACK && similarity > bestSimilarity) {
            bestSimilarity = similarity
            bestMatch = titleMap.get(title)
            bestTitle = title
          }
        }
        
        if (bestMatch) {
          console.log(`[关键词预筛选] ✅ 匹配成功! 相似度: ${bestSimilarity.toFixed(3)}`)
          console.log(`[关键词预筛选] 匹配标题: "${bestTitle}"`)
          console.log(`[关键词预筛选] 原始文件名: "${originalFilename}"`)
          return bestMatch
        } else {
          console.log(`[关键词预筛选] ❌ 匹配失败: 所有候选项相似度均低于阈值 ${MIN_SIMILARITY_FALLBACK}`)
          
          // 回退策略：使用关键词的前60%重新匹配（如果大于一个字，且不是英文标题）
          const keywordLength = keyword.length
          const partialLength = Math.floor(keywordLength * 0.6)
          if (partialLength > 1 && !isPrimarilyEnglish(keyword)) { // 确保大于一个字且不是英文
            const partialKeyword = keyword.substring(0, partialLength)
            console.log(`[关键词预筛选] 尝试前60%关键词: "${partialKeyword}" (原关键词: "${keyword}")`)
            
            // 用前60%关键词重新筛选
            const partialCandidates = []
            for (const title of titleArray) {
              if (title.includes(partialKeyword)) {
                partialCandidates.push(title)
              }
            }
            
            console.log(`[关键词预筛选] 前60%关键词筛选结果: ${partialCandidates.length} 个候选`)
            
            if (partialCandidates.length > 0) {
              // 使用更高的阈值，因为前60%关键词匹配需要更精确
              const MIN_SIMILARITY_PARTIAL = Math.max(0.4, MIN_SIMILARITY_FALLBACK)
              
              let partialBestMatch = null
              let partialBestSimilarity = 0
              let partialBestTitle = ''
              
              for (const title of partialCandidates) {
                const similarity = calculateSimilarity(originalNormalized, title)
                
                if (similarity >= MIN_SIMILARITY_PARTIAL && similarity > partialBestSimilarity) {
                  partialBestSimilarity = similarity
                  partialBestMatch = titleMap.get(title)
                  partialBestTitle = title
                }
              }
              
              if (partialBestMatch) {
                console.log(`[关键词预筛选] ✅ 前60%关键词匹配成功! 相似度: ${partialBestSimilarity.toFixed(3)}`)
                console.log(`[关键词预筛选] 匹配标题: "${partialBestTitle}"`)
                console.log(`[关键词预筛选] 原始文件名: "${originalFilename}"`)
                return partialBestMatch
              } else {
                console.log(`[关键词预筛选] ❌ 前60%关键词匹配失败: 所有候选项相似度均低于阈值 ${MIN_SIMILARITY_PARTIAL}`)
              }
            } else {
              console.log(`[关键词预筛选] ❌ 前60%关键词匹配失败: 数据库中没有包含关键词 "${partialKeyword}" 的标题`)
            }
          }
        }
      } else {
        console.log(`[关键词预筛选] ❌ 匹配失败: 数据库中没有包含关键词 "${keyword}" 的标题`)
        
        // 回退策略：使用关键词的前60%重新匹配（如果大于一个字，且不是英文标题）
        const keywordLength = keyword.length
        const partialLength = Math.floor(keywordLength * 0.6)
        if (partialLength > 1 && !isPrimarilyEnglish(keyword)) { // 确保大于一个字且不是英文
          const partialKeyword = keyword.substring(0, partialLength)
          console.log(`[关键词预筛选] 尝试前60%关键词: "${partialKeyword}" (原关键词: "${keyword}")`)
          
          // 用前60%关键词重新筛选
          const partialCandidates = []
          for (const title of titleArray) {
            if (title.includes(partialKeyword)) {
              partialCandidates.push(title)
            }
          }
          
          console.log(`[关键词预筛选] 前60%关键词筛选结果: ${partialCandidates.length} 个候选`)
          
          if (partialCandidates.length > 0) {
            // 根据候选数量和关键词特征动态调整阈值
            // 系列作品或长关键词可以使用更宽松的阈值
            const isSeriesPartial = /\b(vol|volume|第|code|episode|chapter|part|～|~|afterstory|side story|外伝)\b/i.test(partialKeyword)
            const isLongPartial = partialKeyword.length > 6
            const isPopularPartial = partialCandidates.length > 30
            const isJapanesePartial = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(partialKeyword)
            
            let MIN_SIMILARITY_PARTIAL
            if (partialCandidates.length <= 10) {
              MIN_SIMILARITY_PARTIAL = (isSeriesPartial || isLongPartial || isPopularPartial) ? 0.25 : 0.4
            } else if (partialCandidates.length <= 50) {
              MIN_SIMILARITY_PARTIAL = (isSeriesPartial || isLongPartial || isPopularPartial || isJapanesePartial) ? 0.35 : 0.5
            } else {
              MIN_SIMILARITY_PARTIAL = (isSeriesPartial || isLongPartial || isPopularPartial || isJapanesePartial) ? 0.4 : 0.55
            }
            
            let partialBestMatch = null
            let partialBestSimilarity = 0
            let partialBestTitle = ''
            
            for (const title of partialCandidates) {
              const similarity = calculateSimilarity(originalNormalized, title)
              
              if (similarity >= MIN_SIMILARITY_PARTIAL && similarity > partialBestSimilarity) {
                partialBestSimilarity = similarity
                partialBestMatch = titleMap.get(title)
                partialBestTitle = title
              }
            }
            
            if (partialBestMatch) {
              console.log(`[关键词预筛选] ✅ 前60%关键词匹配成功! 相似度: ${partialBestSimilarity.toFixed(3)}`)
              console.log(`[关键词预筛选] 匹配标题: "${partialBestTitle}"`)
              console.log(`[关键词预筛选] 原始文件名: "${originalFilename}"`)
              return partialBestMatch
            } else {
              console.log(`[关键词预筛选] ❌ 前60%关键词匹配失败: 所有候选项相似度均低于阈值 ${MIN_SIMILARITY_PARTIAL}`)
            }
          } else {
            console.log(`[关键词预筛选] ❌ 前60%关键词匹配失败: 数据库中没有包含关键词 "${partialKeyword}" 的标题`)
          }
        }
      }
    }
  }
  
  // 最终回退策略：去除英文数字和符号后重新匹配
  // 适用于标题中混杂了英文文件名的情况
  if (titleArray && titleArray.length > 0) {
    const searchTermNormalized = normalizeString(searchTerm).toLowerCase()
    const cleanedSearchTerm = removeEnglishNumbersSymbols(searchTermNormalized)
    if (cleanedSearchTerm && cleanedSearchTerm !== searchTermNormalized && cleanedSearchTerm.length >= 2) {
      console.log(`[关键词预筛选] 尝试去除英文数字符号后的关键词: "${cleanedSearchTerm}" (原关键词: "${searchTermNormalized}")`)
      
      // 智能提取清理后的关键词
      const cleanedKeyword = extractSmartKeyword(cleanedSearchTerm)
      
      if (cleanedKeyword && isValidKeyword(cleanedKeyword)) {
        console.log(`[关键词预筛选] 清理后提取关键词: "${cleanedKeyword}"`)
        
        // 用清理后的关键词重新筛选
        const cleanedCandidates = []
        for (const title of titleArray) {
          if (title.includes(cleanedKeyword)) {
            cleanedCandidates.push(title)
          }
        }
        
        console.log(`[关键词预筛选] 清理关键词筛选结果: ${cleanedCandidates.length} 个候选`)
        
        if (cleanedCandidates.length > 0) {
          // 使用稍高的阈值，因为清理后的匹配需要更精确
          const MIN_SIMILARITY_CLEANED = 0.4
          
          let cleanedBestMatch = null
          let cleanedBestSimilarity = 0
          let cleanedBestTitle = ''
          
          for (const title of cleanedCandidates) {
            const similarity = calculateSimilarity(originalNormalized, title)
            
            if (similarity >= MIN_SIMILARITY_CLEANED && similarity > cleanedBestSimilarity) {
              cleanedBestSimilarity = similarity
              cleanedBestMatch = titleMap.get(title)
              cleanedBestTitle = title
            }
          }
          
          if (cleanedBestMatch) {
            console.log(`[关键词预筛选] ✅ 清理关键词匹配成功! 相似度: ${cleanedBestSimilarity.toFixed(3)}`)
            console.log(`[关键词预筛选] 匹配标题: "${cleanedBestTitle}"`)
            console.log(`[关键词预筛选] 原始文件名: "${originalFilename}"`)
            return cleanedBestMatch
          } else {
            console.log(`[关键词预筛选] ❌ 清理关键词匹配失败: 所有候选项相似度均低于阈值 ${MIN_SIMILARITY_CLEANED}`)
          }
        } else {
          console.log(`[关键词预筛选] ❌ 清理关键词匹配失败: 数据库中没有包含关键词 "${cleanedKeyword}" 的标题`)
        }
      }
    }
  }
  
  return foundKeys
}

/**
 * Refine matches using title_jpn for better accuracy
 * 使用 title_jpn 精炼匹配结果以提高准确性
 * @param {Array} foundKeys - Array of candidate keys
 * @param {string} originalFilename - Original filename
 * @param {Object} db - SQLite database instance
 * @returns {Object} Best matching metadata or null
 */
async function refineMatchesWithJapaneseTitle(foundKeys, originalFilename, db) {
  if (foundKeys.length === 0) return null
  
  if (foundKeys.length === 1) {
    // 只有一个匹配，直接查询
    const firstKey = foundKeys[0]
    const meta = await db.get('SELECT * FROM gallery WHERE gid = ? AND token = ?', [firstKey.gid, firstKey.token])
    return meta ? parseMetadataTags(meta) : null
  }
  
  // 多个匹配，使用 title_jpn 优化相似度
  const candidates = []
  for (let idx = 0; idx < foundKeys.length; idx++) {
    const key = foundKeys[idx]
    const meta = await db.get('SELECT * FROM gallery WHERE gid = ? AND token = ?', [key.gid, key.token])
    if (meta) candidates.push(meta)
    
    // 每处理 50 个候选项，让出事件循环
    if (idx % 50 === 0 && idx > 0) {
      await new Promise(resolve => setImmediate(resolve))
    }
  }
  
  // 使用原始文件名与 title 和 title_jpn 计算相似度
  const originalNormalized = normalizeString(originalFilename).toLowerCase()
  const scoredCandidates = []
  for (let idx = 0; idx < candidates.length; idx++) {
    const meta = candidates[idx]
    const titleSim = calculateSimilarity(originalNormalized, meta.title || '')
    const titleJpnSim = calculateSimilarity(originalNormalized, meta.title_jpn || '')
    const maxSim = Math.max(titleSim, titleJpnSim)
    scoredCandidates.push({ meta, similarity: maxSim })
    
    // 每处理 50 个候选项，让出事件循环
    if (idx % 50 === 0 && idx > 0) {
      await new Promise(resolve => setImmediate(resolve))
    }
  }
  
  // 按相似度降序排序
  scoredCandidates.sort((a, b) => b.similarity - a.similarity)
  
  return scoredCandidates[0] ? parseMetadataTags(scoredCandidates[0].meta) : null
}

/**
 * Parse metadata tags from SQLite record
 * 解析 SQLite 记录中的标签数据
 * @param {Object} metadata - Raw metadata from database
 * @returns {Object} Parsed metadata with tags
 */
function parseMetadataTags(metadata) {
  const re = /'/g
  
  metadata.tags = {
    language: metadata.language ? JSON.parse(metadata.language.replace(re, '"')) : undefined,
    parody: metadata.parody ? JSON.parse(metadata.parody.replace(re, '"')) : undefined,
    character: metadata.character ? JSON.parse(metadata.character.replace(re, '"')) : undefined,
    group: metadata.group ? JSON.parse(metadata.group.replace(re, '"')) : undefined,
    artist: metadata.artist ? JSON.parse(metadata.artist.replace(re, '"')) : undefined,
    male: metadata.male ? JSON.parse(metadata.male.replace(re, '"')) : undefined,
    female: metadata.female ? JSON.parse(metadata.female.replace(re, '"')) : undefined,
    mixed: metadata.mixed ? JSON.parse(metadata.mixed.replace(re, '"')) : undefined,
    other: metadata.other ? JSON.parse(metadata.other.replace(re, '"')) : undefined,
    cosplayer: metadata.cosplayer ? JSON.parse(metadata.cosplayer.replace(re, '"')) : undefined,
    rest: metadata.rest ? JSON.parse(metadata.rest.replace(re, '"')) : undefined,
  }
  
  metadata.filecount = +metadata.filecount
  metadata.rating = +metadata.rating
  metadata.posted = +metadata.posted
  metadata.filesize = +metadata.filesize
  metadata.url = `https://exhentai.org/g/${metadata.gid}/${metadata.token}/`
  
  return metadata
}

/**
 * Extract smart keyword from search term, optimized for series
 * 智能提取关键词，针对系列作品优化
 * @param {string} searchTerm - Normalized search term
 * @returns {string} Extracted keyword
 */
function extractSmartKeyword(searchTerm) {
  if (!searchTerm) return searchTerm

  // 验证关键词是否有效（只允许中文和日文字符，且不是通用名称）
  function isValidKeywordLocal(keyword) {
    if (!keyword || keyword.length < 2) return false
    // 不允许纯数字关键词
    if (/^\d+(\.\d+)?$/.test(keyword.trim())) return false
    // 只允许包含中文或日文字符的关键词
    // 中文: \u4e00-\u9fff (CJK统一表意文字)
    // 日文平假名: \u3040-\u309f
    // 日文片假名: \u30a0-\u30ff
    // 日文汉字: \u4e00-\u9fff (与中文重叠)
    const chineseJapaneseRegex = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/
    if (!chineseJapaneseRegex.test(keyword)) return false

    // 过滤掉常见的通用名称和太短的关键词
    // 这些关键词太通用，会匹配到大量不相关的标题
    const commonNames = ['酱', '妹', '姐', '妹子', '姐姐', '妹妹', '老婆', '媳妇', '老婆子', '小妹', '小姐姐', '大姐姐', '小妹妹']
    // 检查关键词是否包含通用名称
    const containsCommonName = commonNames.some(name => keyword.includes(name))
    if (containsCommonName || keyword.length <= 2) return false

    // 对于3-4个字符的关键词，只有包含系列标识符的才有效
    if (keyword.length <= 4 && !/\b(vol|volume|第|code|episode|chapter|part|～|~|no\.?|number|#|酱|妹|姐)\b/i.test(keyword)) {
      return false
    }

    return true
  }

  // 检测系列标识符的正则表达式
  const seriesPatterns = [
    /\s+(vol\.?|volume)\s*\d+/i,  // Vol.1, Volume 2
    /\s+第\s*\d+/i,              // 第1话, 第2集
    /\s+code:?\s*\d+/i,          // code:1, code 2
    /\s+episode\s*\d+/i,         // episode 1
    /\s+chapter\s*\d+/i,         // chapter 1
    /\s+part\s*\d+/i,            // part 1
    /\s+\d+(\.\d+)?$/,           // 末尾的数字，如 1.0, 2
  ]

  // 如果包含系列标识符，提取系列名
  for (const pattern of seriesPatterns) {
    const match = searchTerm.match(pattern)
    if (match) {
      const seriesName = searchTerm.substring(0, match.index).trim()
      if (isValidKeywordLocal(seriesName)) {
        console.log(`[智能关键词] 检测到系列作品: "${searchTerm}" -> 系列名: "${seriesName}"`)
        return seriesName
      }
    }
  }

  // 对于长标题（>8字符），尝试提取更短的关键词以提高匹配成功率
  // 优先提取到常见分隔符（如：- ~ ( 等）前的部分
  if (searchTerm.length > 8) {
    const separators = [' - ', ' ~ ', '～', '(', '（', ':', '：']
    for (const sep of separators) {
      const sepIndex = searchTerm.indexOf(sep)
      if (sepIndex > 2) { // 确保提取的关键词有意义
        const shortKeyword = searchTerm.substring(0, sepIndex).trim()
        if (shortKeyword.length >= 3 && shortKeyword.length <= 10 && isValidKeywordLocal(shortKeyword)) {
          console.log(`[智能关键词] 长标题优化: "${searchTerm}" -> 短关键词: "${shortKeyword}"`)
          return shortKeyword
        }
      }
    }

    // 如果没有找到合适的分隔符，提取前8个字符
    const shortKeyword = searchTerm.substring(0, 8)
    if (isValidKeywordLocal(shortKeyword)) {
      console.log(`[智能关键词] 长标题截取: "${searchTerm}" -> 前8字符: "${shortKeyword}"`)
      return shortKeyword
    }
  }

  // 默认策略：提取第一个空格前的关键词
  const firstSpaceIndex = searchTerm.indexOf(' ')
  const keyword = firstSpaceIndex > 0 ? searchTerm.substring(0, firstSpaceIndex) : searchTerm

  // 如果默认关键词无效，返回整个搜索词
  return isValidKeywordLocal(keyword) ? keyword : searchTerm

  return keyword
}

function isPrimarilyEnglish(str) {
  if (!str) return false
  
  // Count English letters and total characters
  const englishChars = str.match(/[A-Za-z]/g) || []
  const totalChars = str.replace(/\s/g, '').length
  
  if (totalChars === 0) return false
  
  // If more than 70% are English letters, consider it primarily English
  return (englishChars.length / totalChars) > 0.7
}
function matchByHash(book, hashIndex) {
  if (!book.hash || !hashIndex) return []
  
  const hashMatches = hashIndex.get(book.hash)
  if (hashMatches && hashMatches.length > 0) {
    return hashMatches.map(m => ({ gid: m.gid, token: m.token, hash: book.hash }))
  }
  
  return []
}
module.exports = {
  buildTitleIndex,
  findMatchesByTitle,
  refineMatchesWithJapaneseTitle,
  parseMetadataTags,
  matchByHash
}
