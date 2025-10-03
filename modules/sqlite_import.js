/**
 * SQLite Import Module for EhViewer/ExHentai Metadata
 * SQLite 导入模块：用于从 EhViewer 数据库导入元数据
 */

const path = require('path')
const _ = require('lodash')
const { normalizeString, calculateSimilarity } = require('./string_utils')

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
 * Find matches using title index with optimized search strategy
 * 使用标题索引查找匹配项（优化搜索策略）
 * @param {string} searchTerm - Normalized search term
 * @param {string} originalFilename - Original filename for similarity calculation
 * @param {Object} titleMap - Title map from buildTitleIndex
 * @param {Array} titleArray - Title array from buildTitleIndex
 * @returns {Array} Array of matching keys {gid, token, hash}
 */
async function findMatchesByTitle(searchTerm, originalFilename, titleMap, titleArray) {
  let foundKeys = []
  
  if (searchTerm.length < 3) {
    return foundKeys // Too short to search
  }
  
  // 策略1: 先尝试精确匹配（O(1)）
  const exactMatch = titleMap.get(searchTerm)
  if (exactMatch) {
    return exactMatch
  }
  
  // 策略2: 使用优化的线性搜索，收集所有匹配项
  if (titleArray && titleArray.length > 0) {
    const matchedTitles = [] // 存储所有匹配的标题
    
    // 分块处理，避免阻塞事件循环
    const CHUNK_SIZE = 1000
    for (let i = 0; i < titleArray.length; i++) {
      const title = titleArray[i]
      if (title.includes(searchTerm)) {
        const keys = titleMap.get(title)
        if (keys) {
          matchedTitles.push({ title, keys })
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
        // 多个匹配，使用原始文件名计算相似度
        const originalNormalized = normalizeString(originalFilename).toLowerCase()
        
        const scoredMatches = []
        for (let idx = 0; idx < matchedTitles.length; idx++) {
          const { title, keys } = matchedTitles[idx]
          const similarity = calculateSimilarity(originalNormalized, title)
          scoredMatches.push({ keys, similarity, title })
          
          // 每处理 100 个匹配项，让出事件循环
          if (idx % 100 === 0 && idx > 0) {
            await new Promise(resolve => setImmediate(resolve))
          }
        }
        
        // 按相似度降序排序
        scoredMatches.sort((a, b) => b.similarity - a.similarity)
        
        return scoredMatches[0].keys
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
    return await db.get('SELECT * FROM gallery WHERE gid = ? AND token = ?', [firstKey.gid, firstKey.token])
  }
  
  // 多个匹配，使用 title_jpn 优化相似度
  const candidates = []
  for (let idx = 0; idx < foundKeys.length; idx++) {
    const key = foundKeys[idx]
    const meta = await db.get('SELECT gid, token, title, title_jpn FROM gallery WHERE gid = ? AND token = ?', [key.gid, key.token])
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
  
  return scoredCandidates[0].meta
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
 * Match book against database using hash (highest priority)
 * 使用 hash 匹配书籍（最高优先级）
 * @param {Object} book - Book object
 * @param {Map} hashIndex - Hash index from buildTitleIndex
 * @returns {Array} Array of matching keys or empty array
 */
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
