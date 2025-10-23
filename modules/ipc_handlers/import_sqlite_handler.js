/**
 * SQLite导入处理器
 * 这是最大的IPC处理器之一（约427行）
 * 负责从SQLite数据库导入元数据，包括Hash匹配、SHA1匹配、标题匹配和黑名单管理
 */

const { ipcMain } = require('electron')

/**
 * 注册import-sqlite IPC处理器
 */
function registerImportSqliteHandler(dependencies) {
  const {
    sendMessageToWebContents,
    setProgressBar,
    Manga,
    setting,
    // 自定义功能模块
    normalizeString,
    calculateSimilarity,
    generateVariants,
    buildTitleIndex,
    findMatchesByTitle,
    refineMatchesWithJapaneseTitle,
    parseMetadataTags,
    matchByHash,
    matchBySha1FromArchive,
    matchBySha1Online,
    titleIndexCache,
    loadBlacklist,
    saveBlacklist,
    clearBlacklist,
    getBlacklistPath,
    isInBlacklist,
    addToBlacklist
  } = dependencies

  // ==================== @CUSTOM: import-sqlite 处理器 (约427行) ====================
  ipcMain.handle('import-sqlite', async (event, arg) => {
    const { bookList, matchOptions } = arg

    // 解析匹配选项
    const enableHashMatch = matchOptions?.enableHashMatch ?? true
    const enableSha1Match = matchOptions?.enableSha1Match ?? false
    const enableTitleMatch = matchOptions?.enableTitleMatch ?? false
    const enableOnlineSha1 = matchOptions?.enableOnlineSha1 ?? false
    const titleMatchThreshold = matchOptions?.titleMatchThreshold ?? 0.85

    // 加载黑名单
    const blacklist = loadBlacklist()
    let blacklistCount = 0

    // 统计信息
    const stats = {
      total: bookList.length,
      hashMatched: 0,
      sha1Matched: 0,
      titleMatched: 0,
      blacklisted: 0,
      failed: 0,
      skipped: 0
    }

    sendMessageToWebContents(`开始导入元数据，共 ${stats.total} 本书`)
    sendMessageToWebContents(`匹配选项：Hash=${enableHashMatch}, SHA1=${enableSha1Match}, 标题=${enableTitleMatch}, 在线SHA1=${enableOnlineSha1}`)

    // 构建标题索引（如果启用标题匹配）
    let titleIndex = null
    if (enableTitleMatch) {
      sendMessageToWebContents('正在构建标题索引...')
      const metadataDb = require('../database').getMetadataDb()
      if (metadataDb) {
        titleIndex = await buildTitleIndex(metadataDb)
        sendMessageToWebContents(`标题索引构建完成，共 ${titleIndex.size} 条记录`)
      } else {
        sendMessageToWebContents('警告：元数据数据库未连接，标题匹配将被跳过')
      }
    }

    // 逐本书处理
    for (let i = 0; i < bookList.length; i++) {
      const book = bookList[i]
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

        // 1. Hash匹配（最快，最准确）
        if (enableHashMatch && book.hash) {
          matchResult = await matchByHash(book.hash, Manga)
          if (matchResult) {
            stats.hashMatched++
            matched = true
            sendMessageToWebContents(`[${i + 1}/${stats.total}] Hash匹配：${book.title}`)
          }
        }

        // 2. SHA1匹配（从压缩包中提取）
        if (!matched && enableSha1Match && book.filepath) {
          try {
            matchResult = await matchBySha1FromArchive(book.filepath, book.type, Manga)
            if (matchResult) {
              stats.sha1Matched++
              matched = true
              sendMessageToWebContents(`[${i + 1}/${stats.total}] SHA1匹配：${book.title}`)
            }
          } catch (e) {
            // SHA1匹配失败不影响后续匹配
            console.log(`SHA1匹配失败：${book.title}`, e.message)
          }
        }

        // 3. 在线SHA1匹配（最慢，但可能找到新数据）
        if (!matched && enableOnlineSha1 && book.filepath) {
          try {
            matchResult = await matchBySha1Online(book.filepath, book.type, Manga, setting)
            if (matchResult) {
              stats.sha1Matched++
              matched = true
              sendMessageToWebContents(`[${i + 1}/${stats.total}] 在线SHA1匹配：${book.title}`)
            }
          } catch (e) {
            console.log(`在线SHA1匹配失败：${book.title}`, e.message)
          }
        }

        // 4. 标题匹配（模糊匹配，可能不准确）
        if (!matched && enableTitleMatch && titleIndex && book.title) {
          try {
            const titleMatches = findMatchesByTitle(book.title, titleIndex, titleMatchThreshold)
            if (titleMatches && titleMatches.length > 0) {
              // 如果有日文标题，进一步精炼匹配
              let bestMatch = titleMatches[0]
              if (book.japaneseTitle) {
                const refinedMatches = refineMatchesWithJapaneseTitle(
                  book.japaneseTitle,
                  titleMatches,
                  titleMatchThreshold
                )
                if (refinedMatches && refinedMatches.length > 0) {
                  bestMatch = refinedMatches[0]
                }
              }

              matchResult = {
                gid: bestMatch.gid,
                token: bestMatch.token,
                title: bestMatch.title,
                title_jpn: bestMatch.title_jpn,
                category: bestMatch.category,
                uploader: bestMatch.uploader,
                posted: bestMatch.posted,
                filecount: bestMatch.filecount,
                filesize: bestMatch.filesize,
                expunged: bestMatch.expunged,
                rating: bestMatch.rating,
                tags: parseMetadataTags(bestMatch.tags),
                similarity: bestMatch.similarity
              }

              stats.titleMatched++
              matched = true
              sendMessageToWebContents(
                `[${i + 1}/${stats.total}] 标题匹配：${book.title} (相似度: ${(bestMatch.similarity * 100).toFixed(1)}%)`
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
              tags: JSON.stringify(matchResult.tags || {}),
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
          // 未匹配，询问是否加入黑名单
          if (matchOptions?.autoBlacklist) {
            addToBlacklist(book, blacklist, '自动：未匹配到元数据')
            blacklistCount++
            stats.blacklisted++
            sendMessageToWebContents(`[${i + 1}/${stats.total}] 未匹配，已加入黑名单：${book.title}`)
          } else {
            stats.skipped++
            sendMessageToWebContents(`[${i + 1}/${stats.total}] 未匹配：${book.title}`)
          }
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
    sendMessageToWebContents('导入完成！')
    sendMessageToWebContents(
      `统计：总计 ${stats.total} 本，Hash匹配 ${stats.hashMatched} 本，SHA1匹配 ${stats.sha1Matched} 本，` +
      `标题匹配 ${stats.titleMatched} 本，黑名单 ${stats.blacklisted} 本，跳过 ${stats.skipped} 本，失败 ${stats.failed} 本`
    )

    return {
      success: true,
      stats
    }
  })

  console.log('✅ import-sqlite处理器已注册')
}

module.exports = {
  registerImportSqliteHandler
}
