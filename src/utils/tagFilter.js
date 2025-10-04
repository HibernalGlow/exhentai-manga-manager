/**
 * 标签过滤和搜索高亮工具模块
 * 用于处理收藏标签显示、搜索标签高亮以及混合性别搜索
 */

/**
 * 从搜索字符串中解析标签
 * @param {string} searchString - 搜索字符串,如 'f:"loli" m:"shotacon"'
 * @param {Object} cat2letter - 类别到字母的映射对象
 * @returns {Array} 解析出的标签数组,每个元素包含 {cat, tag, letter}
 */
export function parseSearchTags(searchString, cat2letter) {
  const searchTags = []
  if (!searchString || !cat2letter) {
    return searchTags
  }

  const tagPattern = /([a-z]):"([^"]+)"/g
  let match
  while ((match = tagPattern.exec(searchString)) !== null) {
    const [, letter, tag] = match
    // 找到对应的 category
    const cat = Object.entries(cat2letter).find(([_, l]) => l === letter)?.[0]
    if (cat) {
      searchTags.push({ cat, tag, letter })
    }
  }
  
  return searchTags
}

/**
 * 检查标签是否在书籍中精确匹配
 * @param {Object} tagObject - 书籍的标签对象
 * @param {string} cat - 标签类别
 * @param {string} tag - 标签名称
 * @returns {boolean} 是否匹配
 */
export function isTagExactMatch(tagObject, cat, tag) {
  return tagObject[cat] && tagObject[cat].includes(tag)
}

/**
 * 获取可以跨性别匹配的类别列表
 * @param {string} cat - 当前类别
 * @returns {Array} 可以匹配的其他性别类别列表
 */
export function getAlternativeGenderCategories(cat) {
  const genderCategories = ['female', 'male', 'mixed']
  if (!genderCategories.includes(cat)) {
    return []
  }
  return genderCategories.filter(c => c !== cat)
}

/**
 * 检查标签是否在书籍中混合性别匹配
 * @param {Object} tagObject - 书籍的标签对象
 * @param {string} cat - 标签类别
 * @param {string} tag - 标签名称
 * @returns {Object|null} 匹配结果,包含 {matchedCat, letter} 或 null
 */
export function checkMixedGenderMatch(tagObject, cat, tag, cat2letter) {
  const altCats = getAlternativeGenderCategories(cat)
  
  for (const altCat of altCats) {
    if (isTagExactMatch(tagObject, altCat, tag)) {
      const letter = cat2letter?.[altCat] || altCat.charAt(0)
      return { matchedCat: altCat, letter }
    }
  }
  
  return null
}

/**
 * 过滤并生成要显示的收藏标签和搜索标签
 * @param {Object} params - 参数对象
 * @param {Object} params.tagObject - 书籍的标签对象
 * @param {Array} params.collectTags - 收藏的标签数组
 * @param {string} params.searchString - 搜索字符串
 * @param {boolean} params.enableMixedGender - 是否启用混合性别搜索
 * @param {Object} params.cat2letter - 类别到字母的映射
 * @param {boolean} params.showCollectTag - 是否显示收藏标签
 * @returns {Array} 要显示的标签数组
 */
export function filterAndHighlightTags({
  tagObject,
  collectTags = [],
  searchString = '',
  enableMixedGender = false,
  cat2letter = {},
  showCollectTag = true
}) {
  if (!showCollectTag) {
    return []
  }

  const result = []
  const seen = new Set() // 避免重复添加
  
  // 解析搜索字符串中的标签
  const searchTags = parseSearchTags(searchString, cat2letter)
  
  // 创建搜索标签的快速查找映射
  const searchTagMap = new Map()
  searchTags.forEach(searchTag => {
    const key = `${searchTag.cat}-${searchTag.tag}`
    searchTagMap.set(key, searchTag)
  })
  
  // 首先处理收藏标签
  collectTags.forEach(tag => {
    // 精确匹配:书籍有这个标签
    if (isTagExactMatch(tagObject, tag.cat, tag.tag)) {
      const key = `${tag.cat}-${tag.tag}`
      if (!seen.has(key)) {
        const isSearchMatch = searchTagMap.has(key)
        result.push({ 
          ...tag, 
          isCollected: true,
          isSearchMatch: isSearchMatch
        })
        seen.add(key)
      }
      return
    }
    
    // 混合性别搜索:f/m/x 标签互相匹配,但显示书籍实际的标签
    if (enableMixedGender) {
      const mixedMatch = checkMixedGenderMatch(tagObject, tag.cat, tag.tag, cat2letter)
      if (mixedMatch) {
        const key = `${mixedMatch.matchedCat}-${tag.tag}`
        if (!seen.has(key)) {
          const isSearchMatch = searchTagMap.has(key)
          result.push({
            ...tag,
            cat: mixedMatch.matchedCat,
            letter: mixedMatch.letter,
            id: key,
            isMixedMatch: true,
            isCollected: true,
            isSearchMatch: isSearchMatch
          })
          seen.add(key)
        }
      }
    }
  })
  
  // 然后处理搜索标签(未被收藏的)
  searchTags.forEach(searchTag => {
    // 精确匹配
    if (isTagExactMatch(tagObject, searchTag.cat, searchTag.tag)) {
      const key = `${searchTag.cat}-${searchTag.tag}`
      if (!seen.has(key)) {
        result.push({
          cat: searchTag.cat,
          tag: searchTag.tag,
          letter: searchTag.letter,
          id: key,
          color: '#606266', // 未收藏标签使用默认灰色
          isSearchTag: true,
          isCollected: false,
          isSearchMatch: true // 搜索标签本身就是搜索匹配的
        })
        seen.add(key)
      }
      return
    }
    
    // 混合性别搜索的搜索标签
    if (enableMixedGender) {
      const mixedMatch = checkMixedGenderMatch(tagObject, searchTag.cat, searchTag.tag, cat2letter)
      if (mixedMatch) {
        const key = `${mixedMatch.matchedCat}-${searchTag.tag}`
        if (!seen.has(key)) {
          result.push({
            cat: mixedMatch.matchedCat,
            tag: searchTag.tag,
            letter: mixedMatch.letter,
            id: key,
            color: '#606266',
            isMixedMatch: true,
            isSearchTag: true,
            isCollected: false,
            isSearchMatch: true // 搜索标签本身就是搜索匹配的
          })
          seen.add(key)
        }
      }
    }
  })
  
  return result
}
