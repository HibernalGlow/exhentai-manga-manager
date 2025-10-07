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
 * Convert circled numbers to regular Arabic numbers
 * 带圆圈的数字转换为普通阿拉伯数字
 * @param {string} str - Input string
 * @returns {string} String with circled numbers converted to regular numbers
 */
function convertCircledNumbers(str) {
  if (!str) return str
  
  // Unicode范围:
  // ① - ⑳ (U+2460 - U+2473): 带圈数字 1-20
  // ⓪ (U+24EA): 带圈数字 0
  // ㉑ - ㉟ (U+3251 - U+325F): 带圈数字 21-35
  // ㊱ - ㊿ (U+32B1 - U+32BF): 带圈数字 36-50
  const circledNums = {
    '⓪': '0',
    '①': '1', '②': '2', '③': '3', '④': '4', '⑤': '5',
    '⑥': '6', '⑦': '7', '⑧': '8', '⑨': '9', '⑩': '10',
    '⑪': '11', '⑫': '12', '⑬': '13', '⑭': '14', '⑮': '15',
    '⑯': '16', '⑰': '17', '⑱': '18', '⑲': '19', '⑳': '20',
    '㉑': '21', '㉒': '22', '㉓': '23', '㉔': '24', '㉕': '25',
    '㉖': '26', '㉗': '27', '㉘': '28', '㉙': '29', '㉚': '30',
    '㉛': '31', '㉜': '32', '㉝': '33', '㉞': '34', '㉟': '35',
    '㊱': '36', '㊲': '37', '㊳': '38', '㊴': '39', '㊵': '40',
    '㊶': '41', '㊷': '42', '㊸': '43', '㊹': '44', '㊺': '45',
    '㊻': '46', '㊼': '47', '㊽': '48', '㊾': '49', '㊿': '50'
  }
  
  return str.replace(/[⓪①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳㉑㉒㉓㉔㉕㉖㉗㉘㉙㉚㉛㉜㉝㉞㉟㊱㊲㊳㊴㊵㊶㊷㊸㊹㊺㊻㊼㊽㊾㊿]/g, (char) => {
    return circledNums[char] || char
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
 * Remove all punctuation marks from string
 * 移除所有标点符号
 * @param {string} str - Input string
 * @returns {string} String without punctuation
 */
function removePunctuation(str) {
  if (!str) return str
  
  // 移除常见的中英文标点符号
  // 包括: 句号、逗号、感叹号、问号、冒号、分号、引号、括号、破折号等
  return str
    // 中文标点
    .replace(/[，。！？；：、''""「」『』【】（）《》〈〉…—～·]/g, '')
    // 英文标点
    .replace(/[,\.!?;:'"\\[\]{}()<>\-_=+\*\/\\|~`]/g, '')
    // 其他符号
    .replace(/[＠＃＄％＾＆＊]/g, '')
    .trim()
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
 * Remove accidental pinyin characters (misconverted Chinese characters)
 * 移除错误转换的拼音字符（通常是输入法错误导致的）
 * 例如: "xi 島さん" -> "島さん", "to 本" -> "本"
 * @param {string} str - Input string
 * @returns {string} String with pinyin removed
 */
function removePinyinArtifacts(str) {
  if (!str) return str
  
  // 策略：移除孤立的1-20个拉丁字母，它们前后被非拉丁字符包围
  // 这些通常是输入法错误转换的拼音（支持多字拼音如 "shimadao san"）
  return str
    // 移除被CJK字符（中日韩文字）包围的短拉丁词
    // 例如: "xi 島" -> "島", "shimadao san エッチ" -> "エッチ"
    .replace(/(?<=[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\u3400-\u4dbf])\s*[a-z]{1,20}\s+(?=[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\u3400-\u4dbf])/gi, '')
    // 移除标点符号后的孤立拉丁字母（支持更长的拼音）
    // 例如: ", xi 島" -> ", 島"
    .replace(/(?<=[,，.。、:：;；!！?？])\s*[a-z]{1,20}\s+(?=[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff])/gi, '')
    // 移除空格后的孤立单字母或短拼音词（最常见的错误）
    // 例如: " xi " -> " ", " shimadao " -> " "
    .replace(/\s+[a-z]{1,20}\s+/gi, ' ')
    // 清理多余空格
    .replace(/\s+/g, ' ')
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
    .replace(/[第]([一1])[話话集章回期卷巻]?\s*$/i, '')
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
  
  // 预处理：转换带圆圈的数字（应用于所有后续变体）
  const withConvertedCircled = convertCircledNumbers(normalized)
  if (withConvertedCircled !== normalized) {
    variants.add(withConvertedCircled)
  }
  
  // 变体1: 移除所有空格
  const noSpaces = removeAllSpaces(normalized)
  variants.add(noSpaces)
  
  // 变体2: 移除标点符号（新增）
  const noPunctuation = removePunctuation(normalized)
  variants.add(noPunctuation)
  variants.add(removeAllSpaces(noPunctuation))
  // 组合：带圆圈数字转换 + 移除标点
  const noPunctuationCircled = removePunctuation(withConvertedCircled)
  variants.add(noPunctuationCircled)
  variants.add(removeAllSpaces(noPunctuationCircled))
  
  // 变体3: 移除拼音错误转换
  const noPinyin = removePinyinArtifacts(normalized)
  variants.add(noPinyin)
  variants.add(removeAllSpaces(noPinyin))
  
  // 变体4: 移除分隔符后的内容（如 "+ おまけ本"）
  const noSuffix = removeSuffixAfterSeparator(normalized)
  variants.add(noSuffix)
  variants.add(removeAllSpaces(noSuffix))
  // 组合：移除拼音 + 移除后缀
  const noPinyinNoSuffix = removeSuffixAfterSeparator(noPinyin)
  variants.add(noPinyinNoSuffix)
  variants.add(removeAllSpaces(noPinyinNoSuffix))
  // 组合：移除标点 + 移除后缀
  const noPunctuationNoSuffix = removeSuffixAfterSeparator(noPunctuation)
  variants.add(noPunctuationNoSuffix)
  variants.add(removeAllSpaces(noPunctuationNoSuffix))
  
  // 变体5: 中文数字转阿拉伯数字
  const withArabic = chineseToArabic(normalized)
  variants.add(withArabic)
  variants.add(removeAllSpaces(withArabic))
  // 组合：移除拼音 + 数字转换
  const noPinyinArabic = chineseToArabic(noPinyin)
  variants.add(noPinyinArabic)
  variants.add(removeAllSpaces(noPinyinArabic))
  // 组合：移除后缀 + 数字转换
  const noSuffixArabic = chineseToArabic(noSuffix)
  variants.add(noSuffixArabic)
  variants.add(removeAllSpaces(noSuffixArabic))
  // 组合：移除标点 + 数字转换
  const noPunctuationArabic = chineseToArabic(noPunctuation)
  variants.add(noPunctuationArabic)
  variants.add(removeAllSpaces(noPunctuationArabic))
  
  // 变体6: 阿拉伯数字转中文数字
  const withChinese = arabicToChinese(normalized)
  variants.add(withChinese)
  variants.add(removeAllSpaces(withChinese))
  // 组合：移除拼音 + 数字转换
  const noPinyinChinese = arabicToChinese(noPinyin)
  variants.add(noPinyinChinese)
  variants.add(removeAllSpaces(noPinyinChinese))
  // 组合：移除后缀 + 数字转换
  const noSuffixChinese = arabicToChinese(noSuffix)
  variants.add(noSuffixChinese)
  variants.add(removeAllSpaces(noSuffixChinese))
  // 组合：移除标点 + 数字转换
  const noPunctuationChinese = arabicToChinese(noPunctuation)
  variants.add(noPunctuationChinese)
  variants.add(removeAllSpaces(noPunctuationChinese))
  
  // 变体7: 移除末尾的 "1"
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

/**
 * Check if filename is pure numbers or pure Chinese characters
 * 检测文件名是否为纯数字或纯中文字符
 * @param {string} filename - Filename to check
 * @returns {boolean} True if pure numbers or pure Chinese
 */
function isPureNumberOrChinese(filename) {
  if (!filename || typeof filename !== 'string') return false
  
  // Remove file extension for checking
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '')
  
  // Check if contains any Latin letters (A-Z, a-z)
  if (/[A-Za-z]/.test(nameWithoutExt)) {
    return false
  }
  
  // Check if contains any non-Chinese, non-digit, non-separator characters
  // Allow: Chinese characters, digits, spaces, hyphens, dots, parentheses, brackets
  const allowedChars = /^[\u4E00-\u9FFF\u3400-\u4DBF\u20000-\u2A6DF\u2A700-\u2B73F\u2B740-\u2B81F\u2B820-\u2CEAF\u2CEB0-\u2EBEF\d\s\-\.\(\)\[\]]+$/
  
  return allowedChars.test(nameWithoutExt) && nameWithoutExt.trim().length > 0
}

module.exports = {
  normalizeString,
  calculateSimilarity,
  getLCSLength,
  chineseToArabic,
  arabicToChinese,
  convertCircledNumbers,
  removeAllSpaces,
  removePunctuation,
  removeSuffixAfterSeparator,
  removePinyinArtifacts,
  removeTrailingOne,
  generateVariants,
  isPureNumberOrChinese
}
