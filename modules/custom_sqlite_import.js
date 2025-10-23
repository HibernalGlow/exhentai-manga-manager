/**
 * 自定义SQLite导入和标题匹配功能
 * 这是本地自定义功能，独立于上游代码
 */

const { 
  normalizeString, 
  calculateSimilarity,
  generateVariants
} = require('./string_utils')

const {
  buildTitleIndex,
  findMatchesByTitle,
  refineMatchesWithJapaneseTitle,
  parseMetadataTags,
  matchByHash,
  matchBySha1FromArchive,
  matchBySha1Online
} = require('./sqlite_import')

// 标题索引缓存（2小时过期）
const titleIndexCache = {
  data: null,           // { titleMap, titleArray, hashIndex, hasHashColumn }
  dbPath: null,         // 数据库文件路径
  timestamp: null,      // 缓存时间戳
  expiryMs: 2 * 60 * 60 * 1000, // 2小时过期时间
  
  // 检查缓存是否有效
  isValid(dbPath) {
    if (!this.data || !this.timestamp || this.dbPath !== dbPath) {
      return false
    }
    const now = Date.now()
    const age = now - this.timestamp
    return age < this.expiryMs
  },
  
  // 设置缓存
  set(dbPath, data) {
    this.data = data
    this.dbPath = dbPath
    this.timestamp = Date.now()
    const expiryTime = new Date(this.timestamp + this.expiryMs).toLocaleTimeString()
    console.log(`📦 标题索引已缓存，过期时间: ${expiryTime}`)
  },
  
  // 获取缓存
  get() {
    return this.data
  },
  
  // 清除缓存
  clear() {
    this.data = null
    this.dbPath = null
    this.timestamp = null
    console.log('🗑️ 标题索引缓存已清除')
  }
}

module.exports = {
  // 字符串工具
  normalizeString,
  calculateSimilarity,
  generateVariants,
  
  // SQLite导入功能
  buildTitleIndex,
  findMatchesByTitle,
  refineMatchesWithJapaneseTitle,
  parseMetadataTags,
  matchByHash,
  matchBySha1FromArchive,
  matchBySha1Online,
  
  // 缓存管理
  titleIndexCache
}

