/**
 * String utility functions for text normalization and similarity calculation
 * 字符串工具函数：用于文本归一化和相似度计算
 */

/**
 * Normalize string: convert full-width to half-width, remove extra spaces
 * 归一化字符串：全角转半角、移除多余空格
 * @param {string} str - Input string
 * @returns {string} Normalized string
 */
function normalizeString(str) {
  if (!str) return str
  // 全角转半角：ASCII 字符（包括数字、字母、符号）
  return str.replace(/[\uFF01-\uFF5E]/g, (char) => {
    return String.fromCharCode(char.charCodeAt(0) - 0xFEE0)
  })
  // 全角空格转半角空格
  .replace(/\u3000/g, ' ')
  // 多个连续空格替换为一个空格
  .replace(/\s+/g, ' ')
  // 去除首尾空格
  .trim()
}

/**
 * Calculate similarity between two strings using LCS (Longest Common Subsequence)
 * 计算两个字符串的相似度（基于最长公共子序列 LCS）
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity score (0-1)
 */
function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0
  
  // 归一化并转小写
  const s1 = normalizeString(str1).toLowerCase()
  const s2 = normalizeString(str2).toLowerCase()
  
  // 如果完全相同
  if (s1 === s2) return 1.0
  
  // 计算最长公共子序列长度（LCS）
  const lcsLength = getLCSLength(s1, s2)
  
  // 相似度 = 2 * LCS / (len1 + len2)
  const similarity = (2.0 * lcsLength) / (s1.length + s2.length)
  
  // 额外加分：如果 s1 包含在 s2 中或反之
  if (s1.includes(s2) || s2.includes(s1)) {
    const containmentBonus = Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length)
    return Math.min(1.0, similarity + containmentBonus * 0.2)
  }
  
  return similarity
}

/**
 * Calculate LCS (Longest Common Subsequence) length between two strings
 * 最长公共子序列（LCS）长度计算
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} LCS length
 */
function getLCSLength(str1, str2) {
  const m = str1.length
  const n = str2.length
  
  // 使用滚动数组优化空间复杂度
  let prev = new Array(n + 1).fill(0)
  let curr = new Array(n + 1).fill(0)
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        curr[j] = prev[j - 1] + 1
      } else {
        curr[j] = Math.max(curr[j - 1], prev[j])
      }
    }
    // 交换数组
    [prev, curr] = [curr, prev]
    curr.fill(0)
  }
  
  return prev[n]
}

/**
 * Convert Chinese numbers to Arabic numbers
 * 中文数字转阿拉伯数字
 * @param {string} str - Input string
 * @returns {string} String with Chinese numbers converted to Arabic
 */
function chineseToArabic(str) {
  if (!str) return str
  
  const chineseNums = {
    '零': '0', '一': '1', '二': '2', '三': '3', '四': '4',
    '五': '5', '六': '6', '七': '7', '八': '8', '九': '9',
    '〇': '0', '壹': '1', '贰': '2', '叁': '3', '肆': '4',
    '伍': '5', '陆': '6', '柒': '7', '捌': '8', '玖': '9'
  }
  
  return str.replace(/[零一二三四五六七八九〇壹贰叁肆伍陆柒捌玖]/g, (char) => {
    return chineseNums[char] || char
  })
}

/**
 * Convert Arabic numbers to Chinese numbers
 * 阿拉伯数字转中文数字
 * @param {string} str - Input string
 * @returns {string} String with Arabic numbers converted to Chinese
 */
function arabicToChinese(str) {
  if (!str) return str
  
  const arabicNums = {
    '0': '〇', '1': '一', '2': '二', '3': '三', '4': '四',
    '5': '五', '6': '六', '7': '七', '8': '八', '9': '九'
  }
  
  return str.replace(/[0-9]/g, (char) => {
    return arabicNums[char] || char
  })
}

/**
 * Remove all spaces from string
 * 移除所有空格
 * @param {string} str - Input string
 * @returns {string} String without spaces
 */
function removeAllSpaces(str) {
  if (!str) return str
  return str.replace(/\s+/g, '')
}

/**
 * Remove content after separator (for bonus/appendix content)
 * 移除分隔符后的内容（用于去除附加内容如おまけ本、特典等）
 * @param {string} str - Input string
 * @returns {string} String with content after separator removed
 */
function removeSuffixAfterSeparator(str) {
  if (!str) return str
  
  // 移除常见分隔符及其后面的内容
  // 例如: "もよろしくおねがいします + おまけ本" -> "もよろしくおねがいします"
  return str
    // + 号及其后面的内容
    .replace(/\s*[+＋]\s*.+$/i, '')
    // & 号及其后面的内容
    .replace(/\s*[&＆]\s*.+$/i, '')
    // 、号及其后面的内容（日文顿号）
    .replace(/\s*、\s*.+$/i, '')
    // "附" "特典" "おまけ" "bonus" 等关键词开头的附加内容
    .replace(/\s*[(\[（【]?\s*(附|特典|おまけ|ボーナス|bonus|extra|omake).+$/i, '')
    .trim()
}

/**
 * Remove trailing "1" or similar patterns (for series first volume)
 * 移除末尾的 "1"、"01"、"1巻"、"第1话" 等模式（用于系列作品第一卷）
 * @param {string} str - Input string
 * @returns {string} String with trailing patterns removed
 */
function removeTrailingOne(str) {
  if (!str) return str
  
  // 移除末尾的各种 "1" 模式
  return str
    // " 1", " 01", " 001" 等
    .replace(/\s+0*1\s*$/i, '')
    // "第1话", "第1集", "第1章", "第一话" 等
    .replace(/[第]([一1])[话集章回期卷巻]?\s*$/i, '')
    // "vol.1", "vol 1", "volume 1" 等
    .replace(/\s*(vol\.?|volume)\s*0*1\s*$/i, '')
    // 日文: "1巻", "一巻", "第1巻" 等
    .replace(/([第])?([一1])[巻卷]?\s*$/i, '')
    // 括号中的1: "(1)", "（1）", "[1]" 等
    .replace(/\s*[(\[（【]0*1[)\]）】]\s*$/i, '')
}

/**
 * Generate multiple variants of a string for fuzzy matching
 * 生成字符串的多个变体用于模糊匹配
 * @param {string} str - Input string
 * @returns {Array<string>} Array of string variants
 */
function generateVariants(str) {
  if (!str) return [str]
  
  const variants = new Set()
  
  // 原始字符串（归一化）
  const normalized = normalizeString(str).toLowerCase()
  variants.add(normalized)
  
  // 变体1: 移除所有空格
  const noSpaces = removeAllSpaces(normalized)
  variants.add(noSpaces)
  
  // 变体2: 移除分隔符后的内容（如 "+ おまけ本"）
  const noSuffix = removeSuffixAfterSeparator(normalized)
  variants.add(noSuffix)
  variants.add(removeAllSpaces(noSuffix))
  
  // 变体3: 中文数字转阿拉伯数字
  const withArabic = chineseToArabic(normalized)
  variants.add(withArabic)
  variants.add(removeAllSpaces(withArabic))
  // 组合：移除后缀 + 数字转换
  const noSuffixArabic = chineseToArabic(noSuffix)
  variants.add(noSuffixArabic)
  variants.add(removeAllSpaces(noSuffixArabic))
  
  // 变体4: 阿拉伯数字转中文数字
  const withChinese = arabicToChinese(normalized)
  variants.add(withChinese)
  variants.add(removeAllSpaces(withChinese))
  // 组合：移除后缀 + 数字转换
  const noSuffixChinese = arabicToChinese(noSuffix)
  variants.add(noSuffixChinese)
  variants.add(removeAllSpaces(noSuffixChinese))
  
  // 变体5: 移除末尾的 "1"
  const noTrailingOne = removeTrailingOne(normalized)
  variants.add(noTrailingOne)
  variants.add(removeAllSpaces(noTrailingOne))
  variants.add(chineseToArabic(noTrailingOne))
  variants.add(removeAllSpaces(chineseToArabic(noTrailingOne)))
  variants.add(arabicToChinese(noTrailingOne))
  variants.add(removeAllSpaces(arabicToChinese(noTrailingOne)))
  // 组合：移除后缀 + 移除末尾1
  const noSuffixNoOne = removeTrailingOne(noSuffix)
  variants.add(noSuffixNoOne)
  variants.add(removeAllSpaces(noSuffixNoOne))
  variants.add(chineseToArabic(noSuffixNoOne))
  variants.add(removeAllSpaces(chineseToArabic(noSuffixNoOne)))
  variants.add(arabicToChinese(noSuffixNoOne))
  variants.add(removeAllSpaces(arabicToChinese(noSuffixNoOne)))
  
  // 移除空字符串
  variants.delete('')
  
  return Array.from(variants)
}

module.exports = {
  normalizeString,
  calculateSimilarity,
  getLCSLength,
  chineseToArabic,
  arabicToChinese,
  removeAllSpaces,
  removeSuffixAfterSeparator,
  removeTrailingOne,
  generateVariants
}
