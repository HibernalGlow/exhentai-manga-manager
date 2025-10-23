/**
 * @CUSTOM: import-sqlite IPC处理器
 * 从SQLite数据库导入元数据的大型处理器
 * 约430行代码
 */

const { ipcMain, dialog } = require('electron')
const path = require('path')
const { open } = require('sqlite')
const sqlite3 = require('sqlite3')
const _ = require('lodash')
const { performance } = require('node:perf_hooks')

/**
 * 注册import-sqlite处理器
 * 
 * 这个处理器负责：
 * 1. 打开SQLite数据库
 * 2. 构建标题索引（带缓存）
 * 3. 批量匹配书籍元数据
 * 4. 支持多种匹配模式：Hash、SHA1、标题
 * 5. 管理黑名单
 * 6. 更新数据库
 */
function registerImportSqliteHandler(dependencies) {
  const {
    mainWindow,
    Manga,
    setting,
    sendMessageToWebContents,
    createAbortableContext,
    loadBlacklist,
    saveBlacklist,
    getBlacklistPath,
    titleIndexCache,
    buildTitleIndex,
    findMatchesByTitle,
    refineMatchesWithJapaneseTitle,
    parseMetadataTags,
    matchByHash,
    matchBySha1FromArchive,
    findArchiveInFolder,
    getEhviewerDataManually,
    normalizeString,
    generateVariants
  } = dependencies

  ipcMain.handle('import-sqlite', async (event, arg) => {
    const { bookList, matchOptions } = arg
    
    // 创建可中断的上下文
    const ctx = createAbortableContext(event)
    const { controller } = ctx
    
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'SQLite', extensions: ['sqlite'] }]
    })
    
    if (!result.canceled) {
      const db = await open({
        filename: result.filePaths[0],
        driver: sqlite3.Database
      })
      
      // 声明在外层作用域，以便 catch 块也能访问
      let processed = 0
      let matched = 0
      let blacklisted = 0
      let skippedTagged = 0
      let skippedBlacklist = 0
      
      // 加载黑名单
      const blacklist = loadBlacklist()
      const initialBlacklistSize = blacklist.size
      sendMessageToWebContents(`📋 黑名单: 已加载 ${blacklist.size} 个项目 (路径: ${getBlacklistPath()})`)
      
      // 发送开始信息到前端
      const dbPath = path.basename(result.filePaths[0])
      sendMessageToWebContents(`🔄 开始从 ${dbPath} 导入元数据...`)
      sendMessageToWebContents(`📋 匹配选项: ${matchOptions?.matchTitleOnly ? '仅标题' : '全字段'}, 快速模式:${matchOptions?.fastMatch ? '是' : '否'}, 哈希:${matchOptions?.matchHash ? '是' : '否'}, SHA1:${matchOptions?.matchSha1 ? '是' : '否'}, 并发数:${setting.concurrentScan || 4}`)
      
      try {
        const bookListLength = bookList.length
        const BATCH_SIZE = 50
        
        // 快速匹配模式：先加载所有标题到内存
        let titleMap = null
        if (matchOptions?.fastMatch) {
          const dbFilePath = result.filePaths[0]
          
          // 检查缓存是否有效
          if (titleIndexCache.isValid(dbFilePath)) {
            sendMessageToWebContents(`⚡ 快速模式：使用缓存的标题索引...`)
            const cached = titleIndexCache.get()
            titleMap = cached.titleMap
            const titleArray = cached.titleArray
            const hashIndex = cached.hashIndex
            
            sendMessageToWebContents(`✅ 从缓存加载索引：`)
            sendMessageToWebContents(`  - ${titleMap.size} 个唯一标题`)
            sendMessageToWebContents(`  - ${titleArray.length} 个标题数组缓存`)
            if (hashIndex) {
              sendMessageToWebContents(`  - ${hashIndex.size} 个 hash 索引`)
            }
            
            global.titleArray = titleArray
            global.hashIndex = hashIndex
          } else {
            // 缓存无效，重新加载
            sendMessageToWebContents(`⚡ 快速模式：正在加载标题索引...`)
            const t0 = performance.now()
            
            // 检查数据库结构
            let hasHashColumn = false
            try {
              const pragmaResult = await db.all(`PRAGMA table_info(gallery)`)
              hasHashColumn = pragmaResult.some(col => col.name === 'hash')
            } catch (e) {
              console.log('Failed to check table structure:', e)
            }
            
            // 根据是否有 hash 列选择不同的查询
            const allTitles = hasHashColumn 
              ? await db.all('SELECT gid, token, title, title_jpn, hash FROM gallery')
              : await db.all('SELECT gid, token, title, title_jpn FROM gallery')
            const t1 = performance.now()
            sendMessageToWebContents(`✅ 加载了 ${allTitles.length} 个标题，耗时: ${((t1-t0)/1000).toFixed(2)}s`)
            
            // 使用独立模块构建索引
            const indexResult = buildTitleIndex(allTitles, hasHashColumn)
            titleMap = indexResult.titleMap
            const titleArray = indexResult.titleArray
            const hashIndex = indexResult.hashIndex
            
            sendMessageToWebContents(`✅ 标题索引构建完成：`)
            sendMessageToWebContents(`  - ${titleMap.size} 个唯一标题`)
            sendMessageToWebContents(`  - ${titleArray.length} 个标题数组缓存`)
            if (hashIndex) {
              sendMessageToWebContents(`  - ${hashIndex.size} 个 hash 索引`)
            }
            
            global.titleArray = titleArray
            global.hashIndex = hashIndex
            
            // 保存到缓存
            titleIndexCache.set(dbFilePath, {
              titleMap,
              titleArray,
              hashIndex,
              hasHashColumn
            })
          }
        }
        
        // 并发处理
        const CONCURRENCY = setting.concurrentScan || 16
        let i = 0
        
        async function processBatch() {
          if (controller.signal.aborted) {
            throw new Error('Import cancelled by user or system')
          }
          
          const batch = []
          for (; i < bookListLength; i++) {
            const book = bookList[i]
            
            // 跳过已标记和黑名单中的项目
            const bookKey = `${book.id}|${book.title}`
            if (book.status === 'tagged') {
              skippedTagged++
              continue
            }
            if (blacklist.has(bookKey)) {
              skippedBlacklist++
              processed++
              continue
            }
            
            batch.push((async () => {
              if (controller.signal.aborted) return
              
              let metadata
              let matchType = ''
              
              // folder类型特殊处理
              if (book.type === 'folder') {
                const dirname = book.filepath
                const ehviewerData = getEhviewerDataManually(dirname)
                const { gid, token } = ehviewerData || {}
                if (gid && token) {
                  metadata = await db.get('SELECT * FROM gallery WHERE gid = ? AND token = ?', [gid, token])
                  if (metadata) {
                    matchType = 'Folder'
                    sendMessageToWebContents(`✅ [${matchType}] 匹配: ${book.title} -> gid:${gid}`)
                  }
                }
              }
              
              if (metadata === undefined) {
                let filename = path.parse(book.title).name
                const originalFilename = filename
                
                if (matchOptions?.trimTitleRegExp) {
                  try {
                    filename = filename.replace(new RegExp(matchOptions.trimTitleRegExp, 'g'), '').trim()
                  } catch (e) {
                    console.log('trimTitleRegExp error:', e)
                    sendMessageToWebContents(`⚠️ 标题裁剪失败: ${e.message}`)
                  }
                }
                
                // 快速匹配模式
                if (matchOptions?.fastMatch && titleMap) {
                  const searchTerm = normalizeString(filename).toLowerCase()
                  
                  let foundKeys = []
                  
                  // 优先使用 hash 匹配
                  if (matchOptions?.matchHash && book.hash && global.hashIndex) {
                    const hashKeys = matchByHash(book, global.hashIndex)
                    if (hashKeys.length > 0) {
                      foundKeys.push(...hashKeys)
                    }
                  }

                  // SHA1压缩包匹配
                  if (foundKeys.length === 0 && matchOptions?.matchSha1) {
                    const archivePath = findArchiveInFolder(book.filepath)
                    if (archivePath) {
                      sendMessageToWebContents(`🔍 [SHA1压缩包] 尝试匹配: ${path.basename(archivePath)}`)
                      const sha1Match = await matchBySha1FromArchive(archivePath, originalFilename, db)
                      if (sha1Match) {
                        foundKeys.push({ gid: sha1Match.gid, token: sha1Match.token })
                        sendMessageToWebContents(`╔══════════════════════════════════════════════════════════════╗
║                        🎉 匹配成功! 🎉                        ║
║ 匹配方式: SHA1压缩包                                             ║
║ 匹配结果: gid=${sha1Match.gid}                                  ║
╚══════════════════════════════════════════════════════════════╝`)
                      }
                    }
                  }
                  
                  // 标题匹配
                  if (foundKeys.length === 0) {
                    foundKeys = await findMatchesByTitle(searchTerm, originalFilename, titleMap, global.titleArray, 'fast-match')
                    if (foundKeys.length > 1) {
                      sendMessageToWebContents(`🔍 [多匹配] "${originalFilename}" 找到 ${foundKeys.length} 个候选`)
                    }
                  }
                  
                  // 精炼匹配结果
                  if (foundKeys.length > 0) {
                    metadata = await refineMatchesWithJapaneseTitle(foundKeys, originalFilename, db)
                    if (metadata) {
                      matchType = 'FastSQL'
                      if (foundKeys.length > 1) {
                        sendMessageToWebContents(`🎯 [相似度匹配] "${originalFilename}" -> "${metadata.title_jpn || metadata.title}"`)
                      }
                    }
                  }
                  
                  if (!metadata) {
                    // 匹配失败，加入黑名单
                    let failureReason = '自动添加（匹配失败）'
                    if (matchOptions?.matchHash && book.hash && global.hashIndex) {
                      failureReason = '自动添加（Hash匹配失败）'
                    } else if (matchOptions?.matchSha1) {
                      failureReason = '自动添加（SHA1匹配失败）'
                    } else {
                      failureReason = '自动添加（标题匹配失败）'
                    }
                    
                    const bookKey = `${book.id}|${book.title}`
                    blacklist.set(bookKey, {
                      reason: failureReason,
                      filename: book.title,
                      fullPath: book.filepath,
                      addedAt: new Date().toISOString()
                    })
                    blacklisted++
                    sendMessageToWebContents(`❌ [Fast] 未匹配: "${filename}" (已加入黑名单: ${failureReason})`)
                  }
                } else {
                  // 原始SQL匹配模式
                  let sql = ''
                  let params = []
                  if (matchOptions?.matchTitleOnly) {
                    sql = `SELECT * FROM gallery WHERE title LIKE ? OR title_jpn LIKE ?`
                    params = [`%${filename}%`, `%${filename}%`]
                  } else {
                    sql = `SELECT * FROM gallery WHERE torrents LIKE ? OR title LIKE ? OR title_jpn LIKE ? OR thumb LIKE ?`
                    params = [`%${filename}%`, `%${filename}%`, `%${filename}%`, `%${book.coverHash}%`]
                  }
                  if (matchOptions?.matchHash && book.hash) {
                    sql += ` OR hash = ?`
                    params.push(book.hash)
                  }
                  metadata = await db.get(sql, ...params)
                  
                  if (!metadata) {
                    let failureReason = '自动添加（匹配失败）'
                    if (matchOptions?.matchTitleOnly) {
                      failureReason = '自动添加（仅标题匹配失败）'
                    } else if (matchOptions?.matchHash && book.hash) {
                      failureReason = '自动添加（Hash匹配失败）'
                    } else {
                      failureReason = '自动添加（SQL匹配失败）'
                    }
                    
                    const bookKey = `${book.id}|${book.title}`
                    blacklist.set(bookKey, {
                      reason: failureReason,
                      filename: book.title,
                      fullPath: book.filepath,
                      addedAt: new Date().toISOString()
                    })
                    blacklisted++
                    sendMessageToWebContents(`❌ [SQL] 未匹配: "${filename}" (已加入黑名单: ${failureReason})`)
                  } else {
                    matchType = 'SQL'
                  }
                }
              }
              
              if (metadata) {
                if (!matchType) matchType = 'SQL'
                
                // 使用独立模块解析元数据
                metadata = parseMetadataTags(metadata)
                
                // 更新 book 对象
                _.assign(book, _.pick(metadata, ['tags', 'title', 'title_jpn', 'filecount', 'rating', 'posted', 'filesize', 'category', 'url']), { status: 'tagged' })
                
                // 更新数据库
                await Manga.update(book, { where: { id: book.id } })
                matched++
              }
              
              processed++
              if (processed % 10 === 0) {
                sendMessageToWebContents(`进度: ${processed}/${bookListLength} (匹配:${matched}, 黑名单:${blacklisted})`)
              }
            })())
            
            if (batch.length >= CONCURRENCY) {
              await Promise.allSettled(batch)
              batch.length = 0
            }
          }
          
          if (batch.length > 0) {
            await Promise.allSettled(batch)
          }
        }
        
        await processBatch()
        
        // 保存黑名单
        saveBlacklist(blacklist)
        const addedToBlacklist = blacklist.size - initialBlacklistSize
        
        await db.close()
        
        sendMessageToWebContents(`✅ 导入完成！`)
        sendMessageToWebContents(`  处理: ${processed} 本`)
        sendMessageToWebContents(`  匹配: ${matched} 本`)
        sendMessageToWebContents(`  黑名单: ${blacklisted} 本 (新增: ${addedToBlacklist})`)
        sendMessageToWebContents(`  跳过已标记: ${skippedTagged} 本`)
        sendMessageToWebContents(`  跳过黑名单: ${skippedBlacklist} 本`)
        
      } catch (error) {
        sendMessageToWebContents(`❌ 错误: ${error.message}`)
        console.error('Import error:', error)
        throw error
      }
    }
  })
}

module.exports = {
  registerImportSqliteHandler
}

