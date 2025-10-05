/**
 * SQL筛选工具模块
 * 用于优化大数据集的筛选性能
 */

/**
 * 使用SQL数据库查询代替内存过滤
 * @param {string} filterType - 筛选类型
 * @param {Array} bookList - 书籍列表
 * @param {Function} filterBooksByMemory - 内存过滤回退函数
 * @returns {Promise<Array>} 筛选后的书籍列表
 */
export async function filterBooksBySQL(filterType, bookList, filterBooksByMemory) {
  const startTime = performance.now()
  console.log(`🔍 开始SQL筛选: ${filterType}`)

  try {
    let sqlQuery = ''
    let replacements = {}

    switch (filterType) {
      case 'mark':
        sqlQuery = 'SELECT * FROM Metadata WHERE mark = 1'
        break
      case 'hidden':
        // hiddenBook在Manga表中，需要关联查询
        sqlQuery = `
          SELECT m.* FROM Mangas m
          INNER JOIN Metadata md ON m.hash = md.hash
          WHERE m.hiddenBook = 1
        `
        break
      case 'notag':
        sqlQuery = 'SELECT * FROM Metadata WHERE status IN ("non-tag", "tag-failed")'
        break
      case 'nocategory':
        sqlQuery = 'SELECT * FROM Metadata WHERE status = "tagged" AND (category IS NULL OR category = "" OR category = "Misc")'
        break
      case 'duplicateGallery':
        // 筛选重复的URL
        sqlQuery = `
          SELECT * FROM Metadata
          WHERE url IN (
            SELECT url FROM Metadata
            WHERE url IS NOT NULL AND url != ""
            GROUP BY url HAVING COUNT(*) > 1
          )
          ORDER BY url, hash
        `
        break
      default:
        // 对于不支持SQL查询的筛选类型，回退到内存过滤
        console.log(`⚠️ ${filterType} 不支持SQL查询，使用内存过滤`)
        return filterBooksByMemory(filterType, bookList)
    }

    // 执行SQL查询
    const sqlResult = await window.ipcRenderer.invoke('execute-sql-query', {
      query: sqlQuery,
      replacements: replacements
    })

    console.log(`📊 SQL查询返回结果数量: ${sqlResult?.length}`)

    // 检查结果是否有效
    if (!sqlResult || !Array.isArray(sqlResult)) {
      console.warn(`⚠️ SQL查询返回了无效结果，回退到内存过滤`)
      return filterBooksByMemory(filterType, bookList)
    }

    if (sqlResult.length === 0) {
      console.log(`ℹ️ SQL查询未返回结果`)
      return []
    }

    // 使用Map建立快速查找索引（hash -> book）
    const bookMapStartTime = performance.now()
    const bookMap = new Map()
    bookList.forEach(book => {
      if (book.hash) {
        bookMap.set(book.hash, book)
      }
    })
    console.log(`🗺️ 建立Map索引耗时: ${(performance.now() - bookMapStartTime).toFixed(2)}ms, 索引大小: ${bookMap.size}`)

    // 将SQL结果转换为书籍对象格式
    const mapStartTime = performance.now()
    const filteredBooks = sqlResult.map(metadata => {
      // 使用Map快速查找
      const book = bookMap.get(metadata.hash)
      if (book) {
        return book
      }
      // 如果在bookList中找不到，返回null（后面过滤掉）
      return null
    }).filter(book => book !== null)
    
    console.log(`🔄 数据转换耗时: ${(performance.now() - mapStartTime).toFixed(2)}ms, 匹配到: ${filteredBooks.length}/${sqlResult.length}`)

    const endTime = performance.now()
    const duration = endTime - startTime
    console.log(`✅ SQL筛选完成: ${filterType}, 耗时: ${duration.toFixed(2)}ms, 结果数量: ${filteredBooks.length}`)

    return filteredBooks

  } catch (error) {
    console.error(`❌ SQL筛选失败: ${filterType}`, error)
    // 回退到内存过滤
    console.log(`🔄 回退到内存过滤: ${filterType}`)
    return filterBooksByMemory(filterType, bookList)
  }
}

/**
 * 按URL分组排序书籍列表
 * 同一URL的书籍会被排在一起
 * @param {Array} bookList - 书籍列表
 * @returns {Array} 排序后的书籍列表
 */
export function sortByUrlGroup(bookList) {
  const startTime = performance.now()
  console.log(`🔄 开始URL分组排序`)

  // 将书籍按URL分组
  const urlGroups = new Map()
  const noUrlBooks = []

  bookList.forEach(book => {
    if (book.url && book.url !== '') {
      if (!urlGroups.has(book.url)) {
        urlGroups.set(book.url, [])
      }
      urlGroups.get(book.url).push(book)
    } else {
      noUrlBooks.push(book)
    }
  })

  // 对每个URL组内的书籍按hash排序
  urlGroups.forEach((books, url) => {
    books.sort((a, b) => (a.hash || '').localeCompare(b.hash || ''))
  })

  // 将所有组合并，URL按字母顺序排序
  const sortedUrls = Array.from(urlGroups.keys()).sort()
  const sortedBooks = []
  
  sortedUrls.forEach(url => {
    sortedBooks.push(...urlGroups.get(url))
  })

  // 将没有URL的书籍放在最后
  sortedBooks.push(...noUrlBooks)

  const duration = performance.now() - startTime
  console.log(`✅ URL分组排序完成，耗时: ${duration.toFixed(2)}ms, 分组数: ${urlGroups.size}, 无URL: ${noUrlBooks.length}`)

  return sortedBooks
}

/**
 * 检查书籍是否有重复URL
 * @param {Object} book - 书籍对象
 * @param {Array} bookList - 完整书籍列表
 * @returns {boolean} 是否重复
 */
export function isDuplicateGallery(book, bookList) {
  if (!book.url || book.url === '') return false
  const urlCount = bookList.filter(b => b.url === book.url).length
  return urlCount > 1
}
