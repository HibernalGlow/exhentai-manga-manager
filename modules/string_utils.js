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

module.exports = {
  normalizeString,
  calculateSimilarity,
  getLCSLength
}
