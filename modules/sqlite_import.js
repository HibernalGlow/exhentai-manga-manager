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
  if (/^\d+(\.\d+)?$/.test(keyword.trim())) return false
  const chineseJapaneseRegex = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/
  if (!chineseJapaneseRegex.test(keyword)) return false

  const commonNames = ['酱',  '自拍']
  const containsCommonName = commonNames.some(name => keyword.includes(name))
  if (containsCommonName && keyword.length <= 2) return false

  return true
}

/**
 * 去除英文、数字和符号，只保留中文和日文字符
 * @param {string} text - 原始文本
 * @returns {string} 清理后的文本
 */
function removeEnglishNumbersSymbols(text) {
  if (!text) return text
  const chineseJapaneseRegex = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\s]/
  return text.split('').filter(char => chineseJapaneseRegex.test(char)).join('').trim()
}

/**
 * Build title index for fast matching
 * 构建标题索引以加速匹配
 * @param {Array} allTitles - Array of gallery records from database
 * @param {boolean} hasHashColumn - Whether the database has a hash column
 * @returns {Object} Index object with titleMap, titleArray, and hashIndex
 */
function buildTitleIndex(allTitles, hasHashColumn) {
  const titleMap = new Map() // 完整标题 -> [{gid, token, hash}]
  const titleArray = [] // 所有标题的数组（用于线性搜索备用）
  const hashIndex = hasHashColumn ? new Map() : null // hash -> [{gid, token}]
  
  for (const item of allTitles) {
    const title = normalizeString(item.title || '').toLowerCase()
    const titleJpn = normalizeString(item.title_jpn || '').toLowerCase()
    const key = { gid: item.gid, token: item.token, hash: item.hash || null }
    
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
    
    if (hashIndex && key.hash) {
      if (!hashIndex.has(key.hash)) {
        hashIndex.set(key.hash, [])
      }
      hashIndex.get(key.hash).push({ gid: item.gid, token: item.token })
    }
  }
  
  return { titleMap, titleArray, hashIndex }
}

async function quickLinearSearch(searchTerm, titleMap, titleArray, originalFilename) {
  const CHUNK_SIZE = 1000
  const searchLength = searchTerm.replace(/\s+/g, '').length
  const MIN_SIMILARITY = searchLength <= 4 ? 0.5 : 0.3
  
  let bestMatch = null
  let bestSimilarity = 0
  
  for (let i = 0; i < titleArray.length; i++) {
    const title = titleArray[i]
    
    if (title.includes(searchTerm)) {
      if (title.startsWith(searchTerm) || title.startsWith(searchTerm + ' ')) {
        return titleMap.get(title)
      }
      
      const searchRatio = searchTerm.length / title.length
      if (searchRatio >= 0.5) {
        return titleMap.get(title)
      }
      
      const similarity = calculateSimilarity(originalFilename, title)
      
      if (similarity >= MIN_SIMILARITY && similarity > bestSimilarity) {
        bestSimilarity = similarity
        bestMatch = titleMap.get(title)
      }
    }
    
    if (i % CHUNK_SIZE === 0 && i > 0) {
      await new Promise(resolve => setImmediate(resolve))
    }
  }
  
  return bestMatch
}

async function findMatchesByTitle(searchTerm, originalFilename, titleMap, titleArray, source = 'unknown') {
  const cleanedSearchTerm = searchTerm.trim().toLowerCase()
  const hasCJK = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/.test(cleanedSearchTerm)
  const hasNumbers = /\d/.test(cleanedSearchTerm)

  if (!hasCJK && !hasNumbers) {
      if (cleanedSearchTerm.length < 5) {
        console.log(`[${source}] "${originalFilename}" -> ❌ Stage: Reject, Reason: Short, non-CJK, numberless search term "${searchTerm}"`)
        return []
      }
  }

  const originalNormalized = normalizeString(originalFilename).toLowerCase()
  let foundKeys = []
  
  const normalizedOriginal = normalizeString(searchTerm).toLowerCase()
  const exactMatch = titleMap.get(normalizedOriginal)
  if (exactMatch) {
    console.log(`[${source}] "${originalFilename}" -> ✅ Stage: Exact Match, Title: "${normalizedOriginal}"`)
    return exactMatch
  }
  
  /*
  const words = normalizedOriginal.split(/\s+/).filter(word => word.length > 0)
  if (words.length > 1) {
    for (let i = words.length; i >= 2; i--) {
      const partialPhrase = words.slice(0, i).join(' ')
      const groupMatch = titleMap.get(partialPhrase)
      if (groupMatch) {
        if (partialPhrase.length / normalizedOriginal.length > 0.7) {
            console.log(`[${source}] "${originalFilename}" -> ✅ Stage: Group Match, Phrase: "${partialPhrase}" (first ${i} words)`)
            return groupMatch
        }
      }
    }
  }
  */
  
  if (titleArray && titleArray.length > 0) {
    const quickMatch = await quickLinearSearch(normalizedOriginal, titleMap, titleArray, originalFilename)
    if (quickMatch) {
      console.log(`[${source}] "${originalFilename}" -> ✅ Stage: Quick Linear Search, Term: "${normalizedOriginal}"`)
      return quickMatch
    }
  }
  
  const searchVariants = generateVariants(searchTerm)
  
  for (const variant of searchVariants) {
    const exactMatch = titleMap.get(variant)
    if (exactMatch) {
      console.log(`[${source}] "${originalFilename}" -> ✅ Stage: Variant Exact Match, Variant: "${variant}"`)
      return exactMatch
    }
  }
  
  /*
  for (const variant of searchVariants) {
    const variantWords = variant.split(/\s+/).filter(word => word.length > 0)
    if (variantWords.length > 1) {
      for (let i = variantWords.length; i >= 2; i--) {
        const partialPhrase = variantWords.slice(0, i).join(' ')
        const groupMatch = titleMap.get(partialPhrase)
        if (groupMatch) {
            if (partialPhrase.length / normalizedOriginal.length > 0.7) {
                console.log(`[${source}] "${originalFilename}" -> ✅ Stage: Variant Group Match, Phrase: "${partialPhrase}" (from variant "${variant}")`)
                return groupMatch
            }
        }
      }
    }
  }
  */
  
  if (titleArray && titleArray.length > 0) {
    const matchedTitles = []
    
    const CHUNK_SIZE = 1000
    for (let i = 0; i < titleArray.length; i++) {
      const title = titleArray[i]
      
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
        if (title.startsWith(matchedVariant) || title.startsWith(matchedVariant + ' ')) {
          const keys = titleMap.get(title)
          if (keys) {
            const similarity = calculateSimilarity(originalNormalized, title)
            matchedTitles.push({ title, keys, similarity })
          }
        }
        else if (matchedVariant.length / title.length >= 0.5) {
          const keys = titleMap.get(title)
          if (keys) {
            const similarity = calculateSimilarity(originalNormalized, title)
            matchedTitles.push({ title, keys, similarity })
          }
        } else {
          const variantLength = matchedVariant.replace(/\s+/g, '').length
          const MIN_SIMILARITY = variantLength <= 4 ? 0.6 : 0.4
          
          const similarity = calculateSimilarity(originalNormalized, title)
          if (similarity >= MIN_SIMILARITY) {
            const keys = titleMap.get(title)
            if (keys) {
              matchedTitles.push({ title, keys, similarity })
            }
          }
        }
      }
      
      if (i % CHUNK_SIZE === 0 && i > 0) {
        await new Promise(resolve => setImmediate(resolve))
      }
    }
    
    if (matchedTitles.length > 0) {
      if (matchedTitles.length === 1) {
        console.log(`[${source}] "${originalFilename}" -> ✅ Stage: Variant Linear Search, Title: "${matchedTitles[0].title}", Similarity: ${matchedTitles[0].similarity.toFixed(3)}`)
        return matchedTitles[0].keys
      } else {
        matchedTitles.sort((a, b) => b.similarity - a.similarity)
        console.log(`[${source}] "${originalFilename}" -> ✅ Stage: Variant Linear Search (Multiple), Best Title: "${matchedTitles[0].title}", Similarity: ${matchedTitles[0].similarity.toFixed(3)}`)
        return matchedTitles[0].keys
      }
    }
  }
  
  if (titleArray && titleArray.length > 0) {
    const searchTermNormalized = normalizeString(searchTerm).toLowerCase()
    const keyword = extractSmartKeyword(searchTermNormalized, originalFilename, source)
    
    if (keyword.length >= 2 && !/^\d+(\.\d+)?$/.test(keyword.trim()) && isValidKeyword(keyword)) {
      console.log(`[${source}] "${originalFilename}" -> 🔍 Stage: Keyword Pre-screening, Keyword: "${keyword}"`)
      
      const candidates = []
      for (const title of titleArray) {
        if (title.includes(keyword)) {
          candidates.push(title)
        }
      }
      
      console.log(`[${source}] "${originalFilename}" -> 📊 Candidates: ${candidates.length} (from ${titleArray.length})`)
      
      if (candidates.length > 0) {
        let MIN_SIMILARITY_FALLBACK
        const isSeriesKeyword = /\b(vol|volume|第|code|episode|chapter|part|～|~|afterstory|side story|外伝|no\.?|number|#)\b/i.test(keyword)
        const isLongKeyword = keyword.length > 8
        const isPopularSeries = candidates.length > 50 && isSeriesKeyword
        const isJapaneseSeries = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(keyword) && isSeriesKeyword

        if (candidates.length <= 5) {
          MIN_SIMILARITY_FALLBACK = (isSeriesKeyword || isLongKeyword) ? 0.4 : 0.6
        } else if (candidates.length <= 20) {
          MIN_SIMILARITY_FALLBACK = (isSeriesKeyword || isLongKeyword) ? 0.5 : 0.7
        } else {
          MIN_SIMILARITY_FALLBACK = (isSeriesKeyword || isLongKeyword || isPopularSeries || isJapaneseSeries) ? 0.6 : 0.8
        }
        
        console.log(`[${source}] "${originalFilename}" -> 🎯 Dynamic Threshold: ${MIN_SIMILARITY_FALLBACK} (based on ${candidates.length} candidates)`)
        
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
          console.log(`[${source}] "${originalFilename}" -> ✅ Stage: Keyword Match, Title: "${bestTitle}", Similarity: ${bestSimilarity.toFixed(3)}`)
          return bestMatch
        } else {
          console.log(`[${source}] "${originalFilename}" -> ❌ Stage: Keyword Match, Reason: All candidates below threshold ${MIN_SIMILARITY_FALLBACK}`)
          
          const keywordLength = keyword.length
          const partialLength = Math.floor(keywordLength * 0.6)
          if (keywordLength > 10 && partialLength > 4 && !isPrimarilyEnglish(keyword)) {
            const partialKeyword = keyword.substring(0, partialLength)
            console.log(`[${source}] "${originalFilename}" -> Fallback: Trying first 60% of keyword: "${partialKeyword}"`)
            
            const partialCandidates = []
            for (const title of titleArray) {
              if (title.includes(partialKeyword)) {
                partialCandidates.push(title)
              }
            }
            
            console.log(`[${source}] "${originalFilename}" -> Fallback Candidates: ${partialCandidates.length}`)
            
            if (partialCandidates.length > 0) {
              const MIN_SIMILARITY_PARTIAL = Math.max(0.5, MIN_SIMILARITY_FALLBACK)
              
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
                console.log(`[${source}] "${originalFilename}" -> ✅ Stage: Fallback Keyword Match, Title: "${partialBestTitle}", Similarity: ${partialBestSimilarity.toFixed(3)}`)
                return partialBestMatch
              } else {
                console.log(`[${source}] "${originalFilename}" -> ❌ Stage: Fallback Keyword Match, Reason: All candidates below threshold ${MIN_SIMILARITY_PARTIAL}`)
              }
            } else {
              console.log(`[${source}] "${originalFilename}" -> ❌ Stage: Fallback Keyword Match, Reason: No titles contain partial keyword "${partialKeyword}"`)
            }
          }
        }
      } else {
        console.log(`[${source}] "${originalFilename}" -> ❌ Stage: Keyword Pre-screening, Reason: No titles contain keyword "${keyword}"`)
      }
    }
  }
  
  if (titleArray && titleArray.length > 0) {
    const searchTermNormalized = normalizeString(searchTerm).toLowerCase()
    const cleanedSearchTerm = removeEnglishNumbersSymbols(searchTermNormalized)
    if (cleanedSearchTerm && cleanedSearchTerm !== searchTermNormalized && cleanedSearchTerm.length >= 2) {
      console.log(`[${source}] "${originalFilename}" -> Fallback: Trying cleaned keyword: "${cleanedSearchTerm}"`)
      
      const cleanedKeyword = extractSmartKeyword(cleanedSearchTerm, originalFilename, source)
      
      if (cleanedKeyword && isValidKeyword(cleanedKeyword)) {
        console.log(`[${source}] "${originalFilename}" -> Fallback: Extracted cleaned keyword: "${cleanedKeyword}"`)
        
        const cleanedCandidates = []
        for (const title of titleArray) {
          if (title.includes(cleanedKeyword)) {
            cleanedCandidates.push(title)
          }
        }
        
        console.log(`[${source}] "${originalFilename}" -> Fallback Cleaned Candidates: ${cleanedCandidates.length}`)
        
        if (cleanedCandidates.length > 0) {
          const MIN_SIMILARITY_CLEANED = 0.5
          
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
            console.log(`[${source}] "${originalFilename}" -> ✅ Stage: Cleaned Keyword Match, Title: "${cleanedBestTitle}", Similarity: ${cleanedBestSimilarity.toFixed(3)}`)
            return cleanedBestMatch
          } else {
            console.log(`[${source}] "${originalFilename}" -> ❌ Stage: Cleaned Keyword Match, Reason: All candidates below threshold ${MIN_SIMILARITY_CLEANED}`)
          }
        } else {
          console.log(`[${source}] "${originalFilename}" -> ❌ Stage: Cleaned Keyword Match, Reason: No titles contain cleaned keyword "${cleanedKeyword}"`)
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
    const firstKey = foundKeys[0]
    const meta = await db.get('SELECT * FROM gallery WHERE gid = ? AND token = ?', [firstKey.gid, firstKey.token])
    return meta ? parseMetadataTags(meta) : null
  }
  
  const candidates = []
  for (let idx = 0; idx < foundKeys.length; idx++) {
    const key = foundKeys[idx]
    const meta = await db.get('SELECT * FROM gallery WHERE gid = ? AND token = ?', [key.gid, key.token])
    if (meta) candidates.push(meta)
    
    if (idx % 50 === 0 && idx > 0) {
      await new Promise(resolve => setImmediate(resolve))
    }
  }
  
  const originalNormalized = normalizeString(originalFilename).toLowerCase()
  const scoredCandidates = []
  for (let idx = 0; idx < candidates.length; idx++) {
    const meta = candidates[idx]
    const titleSim = calculateSimilarity(originalNormalized, meta.title || '')
    const titleJpnSim = calculateSimilarity(originalNormalized, meta.title_jpn || '')
    const maxSim = Math.max(titleSim, titleJpnSim)
    scoredCandidates.push({ meta, similarity: maxSim })
    
    if (idx % 50 === 0 && idx > 0) {
      await new Promise(resolve => setImmediate(resolve))
    }
  }
  
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
 * @param {string} originalFilename - Original filename for logging
 * @param {string} source - Source of the call for logging
 * @returns {string} Extracted keyword
 */
function extractSmartKeyword(searchTerm, originalFilename, source = 'unknown') {
  if (!searchTerm) return searchTerm

  const cjkOnly = removeEnglishNumbersSymbols(searchTerm).trim()
  if (cjkOnly.length >= 2 && isValidKeyword(cjkOnly)) {
      console.log(`[${source}] "${originalFilename}" -> 🌱 Smart Keyword: Prioritizing CJK part -> "${cjkOnly}"`)
      return cjkOnly
  }

  const seriesPatterns = [
    /\s+(vol\.?|volume)\s*\d+/i,
    /\s+第\s*\d+/i,
    /\s+code:?\s*\d+/i,
    /\s+episode\s*\d+/i,
    /\s+chapter\s*\d+/i,
    /\s+part\s*\d+/i,
    /\s+\d+(\.\d+)?$/,
  ]

  for (const pattern of seriesPatterns) {
    const match = searchTerm.match(pattern)
    if (match) {
      const seriesName = searchTerm.substring(0, match.index).trim()
      if (isValidKeyword(seriesName)) {
        console.log(`[${source}] "${originalFilename}" -> 🌱 Smart Keyword: Detected series "${seriesName}" from "${searchTerm}"`)
        return seriesName
      }
    }
  }

  if (searchTerm.length > 8) {
    const separators = [' - ', ' ~ ', '～', '(', '（', ':', '：']
    for (const sep of separators) {
      const sepIndex = searchTerm.indexOf(sep)
      if (sepIndex > 2) {
        const shortKeyword = searchTerm.substring(0, sepIndex).trim()
        if (shortKeyword.length >= 3 && shortKeyword.length <= 10 && isValidKeyword(shortKeyword)) {
          console.log(`[${source}] "${originalFilename}" -> 🌱 Smart Keyword: Shortened long title to "${shortKeyword}"`)
          return shortKeyword
        }
      }
    }

    const shortKeyword = searchTerm.substring(0, 8)
    if (isValidKeyword(shortKeyword)) {
      console.log(`[${source}] "${originalFilename}" -> 🌱 Smart Keyword: Truncated long title to "${shortKeyword}"`)
      return shortKeyword
    }
  }

  const firstSpaceIndex = searchTerm.indexOf(' ')
  const keyword = firstSpaceIndex > 0 ? searchTerm.substring(0, firstSpaceIndex) : searchTerm

  return isValidKeyword(keyword) ? keyword : searchTerm
}

function isPrimarilyEnglish(str) {
  if (!str) return false
  
  const englishChars = str.match(/[A-Za-z]/g) || []
  const totalChars = str.replace(/\s/g, '').length
  
  if (totalChars === 0) return false
  
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