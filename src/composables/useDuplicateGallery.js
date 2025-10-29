import { ref } from 'vue'

/**
 * 重复画廊检测相关的 composable
 * 包含重复检测和缓存构建
 */
export function useDuplicateGallery() {
  // 重复画廊数量缓存
  const duplicateCountCache = ref(new Map())

  // 检查书籍是否有重复的画廊链接（只检查exhentai和e-hentai的URL）
  const isDuplicateGallery = (book, bookList) => {
    if (!book || !book.url || book.isCollection) {
      return false
    }

    // 只检查exhentai和e-hentai的URL
    if (!book.url.includes('exhentai.org') && !book.url.includes('e-hentai.org')) {
      return false
    }

    // 统计相同url的书籍数量
    const duplicateCount = bookList.filter(b =>
      b.url === book.url && !b.isCollection &&
      (b.url.includes('exhentai.org') || b.url.includes('e-hentai.org'))
    ).length

    // 如果有多个书籍有相同的url，则认为是重复的
    return duplicateCount > 1
  }

  // 获取书籍的重复画廊数量（相同URL的书籍数量）
  const getDuplicateGalleryCount = (book) => {
    if (!book || !book.url || book.isCollection) {
      return 0
    }

    // 只统计exhentai和e-hentai的URL
    if (!book.url.includes('exhentai.org') && !book.url.includes('e-hentai.org')) {
      return 0
    }

    // 从缓存中获取重复数量
    return duplicateCountCache.value.get(book.url) || 0
  }

  // 构建重复画廊数量缓存
  const buildDuplicateCountCache = async () => {
    try {
      console.log('🔍 开始构建重复画廊数量缓存...')
      const startTime = performance.now()

      // 使用SQL查询获取所有URL的重复统计
      const sqlQuery = `
        SELECT url, COUNT(*) as count
        FROM Metadata
        WHERE url IS NOT NULL AND url != ""
        AND (url LIKE '%exhentai.org%' OR url LIKE '%e-hentai.org%')
        GROUP BY url
        HAVING COUNT(*) > 1
      `

      const sqlResult = await window.ipcRenderer.invoke('execute-sql-query', {
        query: sqlQuery,
        replacements: {}
      })

      // 清空缓存
      duplicateCountCache.value.clear()

      // 填充缓存
      if (sqlResult && Array.isArray(sqlResult)) {
        sqlResult.forEach(row => {
          duplicateCountCache.value.set(row.url, row.count)
        })
      }

      console.log(`📊 重复画廊数量缓存构建完成: ${duplicateCountCache.value.size} 个重复URL, 耗时: ${(performance.now() - startTime).toFixed(2)}ms`)

    } catch (error) {
      console.error('❌ 构建重复画廊数量缓存失败:', error)
      // 回退到内存统计
      buildDuplicateCountCacheFallback()
    }
  }

  // 回退方案：内存中构建重复画廊数量缓存
  const buildDuplicateCountCacheFallback = (bookList) => {
    console.log('🔄 使用内存回退方案构建重复画廊数量缓存...')
    const startTime = performance.now()

    // 清空缓存
    duplicateCountCache.value.clear()

    // 统计每个URL出现的次数
    const urlCountMap = new Map()

    bookList.forEach(book => {
      if (book && book.url && !book.isCollection &&
          (book.url.includes('exhentai.org') || book.url.includes('e-hentai.org'))) {
        const count = urlCountMap.get(book.url) || 0
        urlCountMap.set(book.url, count + 1)
      }
    })

    // 只保留重复的URL（数量 > 1）
    urlCountMap.forEach((count, url) => {
      if (count > 1) {
        duplicateCountCache.value.set(url, count)
      }
    })

    console.log(`📊 内存回退方案完成: ${duplicateCountCache.value.size} 个重复URL, 耗时: ${(performance.now() - startTime).toFixed(2)}ms`)
  }

  return {
    // 状态
    duplicateCountCache,

    // 方法
    isDuplicateGallery,
    getDuplicateGalleryCount,
    buildDuplicateCountCache,
    buildDuplicateCountCacheFallback
  }
}