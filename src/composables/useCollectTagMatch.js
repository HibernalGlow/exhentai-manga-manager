import { ref } from 'vue'

/**
 * 收藏标签匹配相关的 composable
 * 包含计算匹配数量和缓存管理
 */
export function useCollectTagMatch() {
  // 收藏标签匹配数量缓存
  const collectTagMatchCache = ref(new Map())

  // 计算书籍匹配收藏标签的数量（带缓存）
  const getCollectTagMatchCount = (book) => {
    if (!book || !book.id) {
      return 0
    }

    // 检查缓存中是否已有计算结果
    if (collectTagMatchCache.value.has(book.id)) {
      return collectTagMatchCache.value.get(book.id)
    }

    // 如果没有缓存，计算并缓存结果
    const matchCount = calculateCollectTagMatchCount(book)
    collectTagMatchCache.value.set(book.id, matchCount)
    return matchCount
  }

  // 实际的计算逻辑
  const calculateCollectTagMatchCount = (book, collectTag) => {
    if (!book || !book.tags || !Array.isArray(collectTag)) {
      return 0
    }

    let matchCount = 0
    const bookTags = []

    // 收集书籍的所有标签
    Object.keys(book.tags).forEach(category => {
      if (Array.isArray(book.tags[category])) {
        book.tags[category].forEach(tag => {
          bookTags.push({ cat: category, tag: tag })
        })
      }
    })

    // 检查每个收藏标签是否匹配
    collectTag.forEach(collectTagItem => {
      const isMatched = bookTags.some(bookTag =>
        bookTag.cat === collectTagItem.cat && bookTag.tag === collectTagItem.tag
      )
      if (isMatched) {
        matchCount++
      }
    })

    return matchCount
  }

  // 重新计算收藏标签匹配缓存
  const recalculateCollectTagMatchCache = (bookList, collectTag) => {
    if (!Array.isArray(bookList)) {
      return
    }

    // 清空缓存
    collectTagMatchCache.value.clear()

    // 预计算所有书籍的匹配数量
    bookList.forEach(book => {
      if (book && book.id) {
        const matchCount = calculateCollectTagMatchCount(book, collectTag)
        collectTagMatchCache.value.set(book.id, matchCount)
      }
    })

    console.log(`预计算了 ${collectTagMatchCache.value.size} 本书的收藏标签匹配数量`)
  }

  return {
    // 状态
    collectTagMatchCache,

    // 方法
    getCollectTagMatchCount,
    calculateCollectTagMatchCount,
    recalculateCollectTagMatchCache
  }
}