/**
 * 元数据填充处理器
 * 负责为无分类书籍从SQLite数据库补全元数据（约275行）
 */

const { ipcMain } = require('electron')
const path = require('path')

/**
 * 注册fill-no-category-metadata IPC处理器
 */
function registerMetadataFillHandler(dependencies) {
  const {
    sendMessageToWebContents,
    setProgressBar,
    Manga,
    setting,
    getMetadataDb,
    // 自定义功能模块
    normalizeString,
    calculateSimilarity,
    generateVariants,
    buildTitleIndex,
    findMatchesByTitle,
    refineMatchesWithJapaneseTitle,
    parseMetadataTags,
    titleIndexCache,
    loadBlacklist,
    isInBlacklist,
    addToBlacklist,
    saveBlacklist
  } = dependencies

  /**
   * 为无分类书籍从 SQLite 数据库补全元数据
   */
  ipcMain.handle('fill-no-category-metadata', async (event, bookList) => {
    try {
      // 检查是否配置了 SQL 数据库路径
      if (!setting.metadataPath) {
        sendMessageToWebContents('错误：未配置元数据数据库路径')
        return { success: false, message: '未配置元数据数据库路径' }
      }

      const metadataDb = getMetadataDb()
      if (!metadataDb) {
        sendMessageToWebContents('错误：无法连接到元数据数据库')
        return { success: false, message: '无法连接到元数据数据库' }
      }

      // 过滤出无分类的书籍
      const noCategoryBooks = bookList.filter(book => !book.category || book.category === 'Unknown')
      if (noCategoryBooks.length === 0) {
        sendMessageToWebContents('没有需要补全元数据的书籍')
        return { success: true, message: '没有需要补全元数据的书籍', stats: { total: 0 } }
      }

      sendMessageToWebContents(`开始为 ${noCategoryBooks.length} 本无分类书籍补全元数据`)

      // 加载黑名单
      const blacklist = loadBlacklist()
      let blacklistCount = 0

      // 统计信息
      const stats = {
        total: noCategoryBooks.length,
        hashMatched: 0,
        titleMatched: 0,
        blacklisted: 0,
        failed: 0,
        skipped: 0
      }

      // 构建标题索引
      sendMessageToWebContents('正在构建标题索引...')
      const titleIndex = await buildTitleIndex(metadataDb)
      sendMessageToWebContents(`标题索引构建完成，共 ${titleIndex.size} 条记录`)

      // 逐本书处理
      for (let i = 0; i < noCategoryBooks.length; i++) {
        const book = noCategoryBooks[i]
        const progress = (i + 1) / stats.total
        setProgressBar(progress)

        try {
          // 检查黑名单
          if (isInBlacklist(book, blacklist)) {
            stats.blacklisted++
            sendMessageToWebContents(`[${i + 1}/${stats.total}] 跳过黑名单：${book.title}`)
            continue
          }

          let matched = false
          let matchResult = null

          // 1. 尝试Hash匹配
          if (book.hash) {
            try {
              const stmt = metadataDb.prepare('SELECT * FROM gallery WHERE sha1 = ? LIMIT 1')
              const row = stmt.get(book.hash)
              if (row) {
                matchResult = row
                stats.hashMatched++
                matched = true
                sendMessageToWebContents(`[${i + 1}/${stats.total}] Hash匹配：${book.title}`)
              }
            } catch (e) {
              console.log(`Hash匹配失败：${book.title}`, e.message)
            }
          }

          // 2. 尝试标题匹配
          if (!matched && book.title) {
            try {
              const titleMatches = findMatchesByTitle(book.title, titleIndex, 0.85)
              if (titleMatches && titleMatches.length > 0) {
                matchResult = titleMatches[0]
                stats.titleMatched++
                matched = true
                sendMessageToWebContents(
                  `[${i + 1}/${stats.total}] 标题匹配：${book.title} (相似度: ${(matchResult.similarity * 100).toFixed(1)}%)`
                )
              }
            } catch (e) {
              console.log(`标题匹配失败：${book.title}`, e.message)
            }
          }

          // 更新数据库
          if (matched && matchResult) {
            try {
              const updateData = {
                tags: JSON.stringify(parseMetadataTags(matchResult.tags) || {}),
                category: matchResult.category,
                uploader: matchResult.uploader,
                rating: matchResult.rating ? parseFloat(matchResult.rating) : null,
                posted: matchResult.posted,
                filecount: matchResult.filecount ? parseInt(matchResult.filecount) : null,
                filesize: matchResult.filesize ? parseInt(matchResult.filesize) : null
              }

              // 如果有更好的标题，也更新标题
              if (matchResult.title && matchResult.title !== book.title) {
                updateData.title = matchResult.title
              }

              await Manga.update(updateData, { where: { id: book.id } })
            } catch (e) {
              console.log(`更新数据库失败：${book.title}`, e.message)
              stats.failed++
            }
          } else {
            // 未匹配，加入黑名单
            addToBlacklist(book, blacklist, '自动：无分类且未匹配到元数据')
            blacklistCount++
            stats.blacklisted++
            sendMessageToWebContents(`[${i + 1}/${stats.total}] 未匹配，已加入黑名单：${book.title}`)
          }
        } catch (e) {
          console.error(`处理失败：${book.title}`, e)
          stats.failed++
          sendMessageToWebContents(`[${i + 1}/${stats.total}] 错误：${book.title} - ${e.message}`)
        }
      }

      // 保存黑名单
      if (blacklistCount > 0) {
        saveBlacklist(blacklist)
        sendMessageToWebContents(`已保存黑名单，新增 ${blacklistCount} 条记录`)
      }

      // 完成
      setProgressBar(-1)
      sendMessageToWebContents('补全元数据完成！')
      sendMessageToWebContents(
        `统计：总计 ${stats.total} 本，Hash匹配 ${stats.hashMatched} 本，` +
        `标题匹配 ${stats.titleMatched} 本，黑名单 ${stats.blacklisted} 本，跳过 ${stats.skipped} 本，失败 ${stats.failed} 本`
      )

      return {
        success: true,
        stats
      }
    } catch (error) {
      console.error('fill-no-category-metadata error:', error)
      setProgressBar(-1)
      sendMessageToWebContents(`错误：${error.message}`)
      return {
        success: false,
        message: error.message
      }
    }
  })

  console.log('✅ 元数据填充处理器已注册')
}

module.exports = {
  registerMetadataFillHandler
}


