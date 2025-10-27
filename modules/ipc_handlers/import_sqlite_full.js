/**
 * Import SQLite IPC处理器（完整版）
 * @CUSTOM: 本地自定义功能，包含完整的匹配逻辑和黑名单管理
 * 
 * 功能：
 * - import-sqlite: 从SQLite数据库导入元数据
 * - 支持Hash匹配、SHA1匹配、标题匹配（快速模式）
 * - 自动黑名单管理
 * - 标题索引缓存
 * - clear-match-blacklist: 清空黑名单
 * - get-blacklist-stats: 获取黑名单统计
 * - add-to-blacklist: 添加到黑名单
 * - remove-from-blacklist: 从黑名单移除
 * - get-blacklist-details: 获取黑名单详情
 * - clear-title-index-cache: 清除标题索引缓存
 * - get-title-index-cache-status: 获取缓存状态
 */

const { ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const _ = require('lodash')
const sqlite3 = require('sqlite3')
const { open } = require('sqlite')
const { performance } = require('node:perf_hooks')

/**
 * 注册import-sqlite及相关处理器
 */
function registerImportSqliteFullHandlers(dependencies) {
  const {
    mainWindow,
    sendMessageToWebContents,
    setProgressBar,
    setting,
    Manga,
    Metadata,
    saveBookToDatabase,
    createAbortableContext,
    // 辅助函数
    findArchiveInFolder,
    getEhviewerDataManually,
    coverAndHashInMem,
    // 自定义匹配模块
    normalizeString,
    generateVariants,
    buildTitleIndex,
    findMatchesByTitle,
    refineMatchesWithJapaneseTitle,
    parseMetadataTags,
    matchByHash,
    matchBySha1FromArchive,
    titleIndexCache,
    // 黑名单模块
    loadBlacklist,
    saveBlacklist,
    clearBlacklist,
    getBlacklistPath
  } = dependencies

  // ==================== import-sqlite 主处理器 ====================
  ipcMain.handle('import-sqlite', async (event, arg) => {
    const { bookList, matchOptions, defaultSqlPath } = arg
    
    // 创建可中断的上下文
    const ctx = createAbortableContext(event)
    const { controller } = ctx
    
    let dbPath
    
    // 如果设置中有默认SQL路径且文件存在，直接使用
    if (defaultSqlPath && fs.existsSync(defaultSqlPath)) {
      dbPath = defaultSqlPath
      sendMessageToWebContents(`📂 使用默认数据库: ${path.basename(dbPath)}`)
    } else {
      // 否则打开文件选择对话框
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [{ name: 'SQLite', extensions: ['sqlite'] }]
      })
      
      if (result.canceled || !result.filePaths.length) {
        ctx.cleanup()
        return { success: false, message: '用户取消操作' }
      }
      
      dbPath = result.filePaths[0]
      sendMessageToWebContents(`📂 打开数据库: ${path.basename(dbPath)}`)
    }
    
    if (dbPath) {
      const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
      })
      
      // 声明在外层作用域，以便 catch 块也能访问
      let processed = 0
      let matched = 0
      let blacklisted = 0
      let skippedTagged = 0
      let skippedBlacklist = 0
      
      // 加载黑名单（从 STORE_PATH/match-blacklist.json）
      const blacklist = loadBlacklist()
      const initialBlacklistSize = blacklist.size
      sendMessageToWebContents(`📋 黑名单: 已加载 ${blacklist.size} 个项目 (路径: ${getBlacklistPath()})`)
      
      // 发送开始信息到前端
      const dbFileName = path.basename(dbPath)
      sendMessageToWebContents(`🔄 开始从 ${dbFileName} 导入元数据...`)
      sendMessageToWebContents(`📋 匹配选项: ${matchOptions?.matchTitleOnly ? '仅标题' : '全字段'}, 快速模式:${matchOptions?.fastMatch ? '是' : '否'}, 哈希:${matchOptions?.matchHash ? '是' : '否'}, SHA1:${matchOptions?.matchSha1 ? '是' : '否'}, 并发数:${setting.concurrentScan || 4}`)
      
      try {
        const re = /'/g
        const bookListLength = bookList.length
        const BATCH_SIZE = 50 // 每批处理50个，定期让出事件循环
        
        // 快速匹配模式：先加载所有标题到内存
        let titleMap = null
        if (matchOptions?.fastMatch) {
          // 检查缓存是否有效
          if (titleIndexCache.isValid(dbPath)) {
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
            
            // 将索引存储到全局变量中
            global.titleArray = titleArray
            global.hashIndex = hashIndex
          } else {
            // 缓存无效，重新加载
            sendMessageToWebContents(`⚡ 快速模式：正在加载标题索引...`)
            const t0 = performance.now()
            // 先检查数据库结构，看是否有 hash 列
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
            
            // 将索引存储到全局变量中
            global.titleArray = titleArray
            global.hashIndex = hashIndex
            
            // 保存到缓存
            titleIndexCache.set(dbPath, {
              titleMap,
              titleArray,
              hashIndex,
              hasHashColumn
            })
          }
        }
        
        // 并发处理部分，使用 setting.concurrentScan 配置
        const CONCURRENCY = setting.concurrentScan || 16;
        let i = 0;
        
        async function processBatch() {
          // 检查是否已中断
          if (controller.signal.aborted) {
            throw new Error('Import cancelled by user or system')
          }
          
          const batch = [];
          for (; i < bookListLength; i++) {
            const book = bookList[i];
            
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
                // 再次检查中断信号
                if (controller.signal.aborted) return;
                
                // 在闭包中创建 book 的深拷贝，避免循环变量捕获问题
                const currentBook = _.cloneDeep(book);
                
                let metadata;
                let matchType = '';
                
                // folder类型特殊处理
                if (currentBook.type === 'folder') {
                  const dirname = currentBook.filepath;
                  const ehviewerData = getEhviewerDataManually(dirname);
                  const { gid, token } = ehviewerData || {};
                  if (gid && token) {
                    metadata = await db.get('SELECT * FROM gallery WHERE gid = ? AND token = ?', [gid, token]);
                    if (metadata) {
                      matchType = 'Folder';
                      sendMessageToWebContents(`✅ [${matchType}] 匹配: ${currentBook.title} -> gid:${gid}`);
                    }
                  }
                }
                
                if (metadata === undefined) {
                  let filename = path.parse(currentBook.title).name;
                  const originalFilename = filename;
                  
                  if (matchOptions?.trimTitleRegExp) {
                    try {
                      filename = filename.replace(new RegExp(matchOptions.trimTitleRegExp, 'g'), '').trim();
                    } catch (e) {
                      console.log('trimTitleRegExp error:', e);
                      sendMessageToWebContents(`⚠️ 标题裁剪失败: ${e.message}`);
                    }
                  }
                  
                  // 快速匹配模式：使用优化的查找策略
                  if (matchOptions?.fastMatch && titleMap) {
                    // 归一化搜索词：全角转半角 + 转小写
                    const searchTerm = normalizeString(filename).toLowerCase()
                    
                    // 调试：显示前10个搜索词及其变体
                    if (processed < 10) {
                      const variants = generateVariants(searchTerm)
                      sendMessageToWebContents(`🔍 [调试] 搜索词: "${searchTerm}" (${variants.length} 个变体)`)
                      sendMessageToWebContents(`  变体: ${variants.slice(0, 5).join(', ')}${variants.length > 5 ? '...' : ''}`)
                    }
                    
                    let foundKeys = []
                    
                    // 优先使用 hash 匹配（使用独立模块）
                    if (matchOptions?.matchHash && currentBook.hash && global.hashIndex) {
                      const hashKeys = matchByHash(currentBook, global.hashIndex)
                      if (hashKeys.length > 0) {
                        foundKeys.push(...hashKeys)
                      }
                    }

                    // 如果 hash 没匹配到，尝试SHA1压缩包匹配
                    if (foundKeys.length === 0 && matchOptions?.matchSha1) {
                      const archivePath = findArchiveInFolder(currentBook.filepath)
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
                    
                    // 如果 hash 和 SHA1 都没匹配到，使用标题匹配（使用独立模块）
                    if (foundKeys.length === 0) {
                      foundKeys = await findMatchesByTitle(searchTerm, originalFilename, titleMap, global.titleArray, 'fast-match')
                      // 输出调试信息
                      if (foundKeys.length > 1) {
                        sendMessageToWebContents(`🔍 [多匹配] "${originalFilename}" 找到 ${foundKeys.length} 个候选`)
                      }
                    }
                    
                    // 精炼匹配结果（使用独立模块）
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
                      // 匹配失败，加入黑名单 - 根据失败阶段设置不同reason
                      let failureReason = '自动添加（匹配失败）'
                      if (matchOptions?.matchHash && currentBook.hash && global.hashIndex) {
                        // Hash匹配已启用但失败
                        failureReason = '自动添加（Hash匹配失败）'
                      } else if (matchOptions?.matchSha1) {
                        // SHA1匹配已启用但失败
                        failureReason = '自动添加（SHA1匹配失败）'
                      } else {
                        // 标题匹配失败
                        failureReason = '自动添加（标题匹配失败）'
                      }
                      
                      const bookKey = `${currentBook.id}|${currentBook.title}`
                      blacklist.set(bookKey, {
                        reason: failureReason,
                        filename: currentBook.title,
                        fullPath: currentBook.filepath,
                        addedAt: new Date().toISOString()
                      })
                      blacklisted++
                      
                      // 移除"标题过短跳过"的提示，所有未匹配的都显示相同消息
                      sendMessageToWebContents(`❌ [Fast] 未匹配: "${filename}" (已加入黑名单: ${failureReason})`)
                    }
                  } else {
                    // 原始匹配模式（直接 SQL 查询，无归一化支持，不推荐）
                    // 注意：SQLite LIKE 不支持全角/半角归一化，可能导致匹配失败
                    let sql = '';
                    let params = [];
                    if (matchOptions?.matchTitleOnly) {
                      sql = `SELECT * FROM gallery WHERE title LIKE ? OR title_jpn LIKE ?`;
                      params = [`%${filename}%`, `%${filename}%`];
                    } else {
                      sql = `SELECT * FROM gallery WHERE torrents LIKE ? OR title LIKE ? OR title_jpn LIKE ? OR thumb LIKE ?`;
                      params = [`%${filename}%`, `%${filename}%`, `%${filename}%`, `%${currentBook.coverHash}%`];
                    }
                    if (matchOptions?.matchHash && currentBook.hash) {
                      sql += ` OR hash = ?`;
                      params.push(currentBook.hash);
                    }
                    metadata = await db.get(sql, ...params);
                    
                    if (!metadata) {
                      // 匹配失败，加入黑名单 - 根据匹配选项设置不同reason
                      let failureReason = '自动添加（匹配失败）'
                      if (matchOptions?.matchTitleOnly) {
                        failureReason = '自动添加（仅标题匹配失败）'
                      } else if (matchOptions?.matchHash && currentBook.hash) {
                        failureReason = '自动添加（Hash匹配失败）'
                      } else {
                        failureReason = '自动添加（SQL匹配失败）'
                      }
                      
                      const bookKey = `${currentBook.id}|${currentBook.title}`
                      blacklist.set(bookKey, {
                        reason: failureReason,
                        filename: currentBook.title,
                        fullPath: currentBook.filepath,
                        addedAt: new Date().toISOString()
                      })
                      blacklisted++
                      sendMessageToWebContents(`❌ [SQL] 未匹配: "${filename}" (已加入黑名单: ${failureReason})`);
                    } else {
                      matchType = 'SQL';
                    }
                  }
                }
                
                if (metadata) {
                  if (!matchType) matchType = 'SQL'; // 如果没有设置matchType，说明是SQL匹配
                  
                  // 使用独立模块解析元数据
                  metadata = parseMetadataTags(metadata);

                  // 如果元数据没有哈希，则根据gid和token生成一个稳定的哈希
                  if (!metadata.hash && metadata.gid && metadata.token) {
                    metadata.hash = `g${metadata.gid}t${metadata.token}`;
                    sendMessageToWebContents(`⚠️ 为 GID ${metadata.gid} 生成了临时哈希: ${metadata.hash}`);
                  }
                  
                  // 更新 currentBook 对象（手动分配）
                  currentBook.tags = metadata.tags;
                  currentBook.title = metadata.title;
                  currentBook.title_jpn = metadata.title_jpn;
                  currentBook.filecount = metadata.filecount;
                  currentBook.rating = metadata.rating;
                  currentBook.posted = metadata.posted;
                  currentBook.filesize = metadata.filesize;
                  currentBook.category = metadata.category;
                  currentBook.url = metadata.url;
                  currentBook.status = 'tagged';
                  
                  // 确保 hash 存在：优先使用 metadata.hash，否则保持原有的 currentBook.hash
                  if (metadata.hash) {
                    currentBook.hash = metadata.hash;
                  } else if (!currentBook.hash) {
                    // 如果 currentBook.hash 也不存在，尝试从 gid 和 token 生成
                    if (metadata.gid && metadata.token) {
                      currentBook.hash = `g${metadata.gid}t${metadata.token}`;
                      sendMessageToWebContents(`⚠️ 为 book 生成了哈希: ${currentBook.hash}`);
                    } else {
                      sendMessageToWebContents(`❌ 错误: 无法为 book 生成哈希值`);
                      sendMessageToWebContents(`  currentBook: ${JSON.stringify(currentBook)}`);
                      sendMessageToWebContents(`  metadata: ${JSON.stringify(metadata)}`);
                    }
                  }

                  // 调试日志
                  if (!currentBook.hash) {
                    sendMessageToWebContents(`❌ 严重错误: 保存前 currentBook.hash 缺失! 标题: ${currentBook.title}`);
                    sendMessageToWebContents(`  元数据对象: ${JSON.stringify(metadata)}`);
                    sendMessageToWebContents(`  currentBook 对象: ${JSON.stringify(currentBook)}`);
                  }
                  
                  // 额外验证和调试
                  sendMessageToWebContents(`🔍 [调试] 保存前检查: currentBook.hash = "${currentBook.hash}", metadata.hash = "${metadata.hash}"`);
                  
                  // 实时保存到数据库（Manga 表 + Metadata 表）
                  // 注意：saveBookToDatabase 已经包含了 Manga 和 Metadata 参数，只需要传递 book
                  await saveBookToDatabase(currentBook);
                  
                  if (matchType === 'SQL' || matchType === 'FastSQL') {
                    // 使用完整的文件原名（包含扩展名前的完整部分）
                    // 处理 folder 类型书籍可能没有 path 属性的情况
                    const bookPath = currentBook.path || currentBook.filepath || currentBook.title
                    const originalFileName = path.parse(bookPath).name;
                    // 优先显示日文标题
                    const matchedTitle = metadata.title_jpn || metadata.title || 'N/A';
                    sendMessageToWebContents(`╔══════════════════════════════════════════════════════════════╗
║                        🎉 匹配成功! 🎉                        ║
║ 匹配方式: ${matchType}                                            ║
║ 文件名: "${originalFileName}"                                     ║
║ 匹配标题: "${matchedTitle}"                                       ║
║ GID: ${metadata.gid}                                              ║
╚══════════════════════════════════════════════════════════════╝`);
                  }
                  matched++;
                }
                processed++;
              })())
            
            // 当 batch 达到并发数限制时，跳出循环处理这批数据
            if (batch.length >= CONCURRENCY) {
              i++ // 为下一次循环准备
              break
            }
          }
          await Promise.all(batch);
          setProgressBar(processed / bookListLength);
          
          // 让出事件循环，保持 UI 响应（增加延迟以提高响应性）
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        
        // 每批次报告进度，并让出更多时间给主线程
        let lastReportTime = Date.now();
        let lastSaveBlacklistSize = initialBlacklistSize;
        
        while (i < bookListLength && !controller.signal.aborted) {
          await processBatch();
          
          const now = Date.now();
          // 每 300ms 或每完成一定数量报告一次进度（降低报告频率减少 IPC 开销）
          if (now - lastReportTime > 300 || processed === bookListLength) {
            const percent = ((processed / bookListLength) * 100).toFixed(1);
            sendMessageToWebContents(`📊 进度: ${processed}/${bookListLength} (${percent}%), 已匹配: ${matched}`);
            lastReportTime = now;
          }
          
          // 定期保存黑名单（每新增100个项目保存一次）
          if (blacklist.size - lastSaveBlacklistSize >= 100) {
            const saved = saveBlacklist(blacklist);
            if (saved) {
              console.log(`[定期保存] 黑名单已保存, 当前总数: ${blacklist.size}`);
            }
            lastSaveBlacklistSize = blacklist.size;
          }
        }
        
        // 检查是否因中断而退出
        if (controller.signal.aborted) {
          throw new Error('Import cancelled')
        }
        await db.close()
        setProgressBar(-1)
        
        // 保存黑名单到文件
        const newBlacklistCount = blacklist.size - initialBlacklistSize
        if (newBlacklistCount > 0) {
          const actualBlacklistPath = getBlacklistPath()
          const saved = saveBlacklist(blacklist)
          if (saved) {
            sendMessageToWebContents(`💾 已保存 ${newBlacklistCount} 个新增黑名单项目到: ${actualBlacklistPath}`)
          } else {
            sendMessageToWebContents(`⚠️ 黑名单保存失败: ${actualBlacklistPath}`)
          }
        } else {
          sendMessageToWebContents(`ℹ️ 无新增黑名单项目`)
        }
        
        // 最终统计
        const totalSkipped = skippedTagged + skippedBlacklist
        const matchRate = bookListLength > 0 ? ((matched / bookListLength) * 100).toFixed(1) : 0;
        console.log(`Import completed: ${matched} matched, ${blacklisted} blacklisted, out of ${processed} processed`)
        sendMessageToWebContents(`🎉 导入完成!`);
        sendMessageToWebContents(`  ✅ 成功匹配: ${matched} (${matchRate}%)`);
        sendMessageToWebContents(`  ⛔ 新增黑名单: ${blacklisted}`);
        sendMessageToWebContents(`  📋 黑名单总数: ${blacklist.size}`);
        sendMessageToWebContents(`  📦 总处理: ${processed}`);
        if (totalSkipped > 0) {
          sendMessageToWebContents(`  ⏭️  跳过: 已标记 ${skippedTagged} 个，黑名单 ${skippedBlacklist} 个`);
        }
      } catch (e) {
        console.log(e)
        sendMessageToWebContents(`❌ 导入错误: ${e.message || e}`);
        await db.close()
        setProgressBar(-1)
        
        // 即使出错或中断，也要保存已收集的黑名单
        const newBlacklistCount = blacklist.size - initialBlacklistSize
        if (newBlacklistCount > 0) {
          const actualBlacklistPath = getBlacklistPath()
          const saved = saveBlacklist(blacklist)
          if (saved) {
            sendMessageToWebContents(`💾 已保存 ${newBlacklistCount} 个新增黑名单项目到: ${actualBlacklistPath}`)
          } else {
            sendMessageToWebContents(`⚠️ 黑名单保存失败: ${actualBlacklistPath}`)
          }
        }
      }
      // 不返回整个 bookList，避免 IPC 传输大量数据导致卡死
      // 让前端重新加载书籍列表
      return {
        success: true,
        matched,
        blacklisted,
        processed,
        skipped: skippedTagged + skippedBlacklist
      }
    } else {
      return {
        success: false
      }
    }
  })

  // ==================== 黑名单相关处理器 ====================
  
  // 清空匹配黑名单
  ipcMain.handle('clear-match-blacklist', async (event, customPath) => {
    try {
      const result = clearBlacklist()
      if (result) {
        sendMessageToWebContents(`✅ 已清空黑名单: ${getBlacklistPath()}`)
        return { success: true, path: getBlacklistPath() }
      } else {
        sendMessageToWebContents(`❌ 清空黑名单失败`)
        return { success: false }
      }
    } catch (e) {
      console.log('Clear blacklist error:', e)
      sendMessageToWebContents(`❌ 清空黑名单失败: ${e.message}`)
      return { success: false, error: e.message }
    }
  })

  // 获取黑名单统计信息
  ipcMain.handle('get-blacklist-stats', async (event, customPath) => {
    try {
      const blacklist = loadBlacklist()
      return {
        success: true,
        count: blacklist.size,
        path: getBlacklistPath()
      }
    } catch (e) {
      console.log('Get blacklist stats error:', e)
      return { success: false, error: e.message }
    }
  })

  // 手动添加项目到黑名单
  ipcMain.handle('add-to-blacklist', async (event, { book, reason = '手动添加' }) => {
    try {
      const blacklist = loadBlacklist()
      const bookKey = `${book.id}|${book.title}`
      
      blacklist.set(bookKey, {
        reason: reason,
        filename: book.title,
        fullPath: book.filepath,
        addedAt: new Date().toISOString()
      })
      
      const saved = saveBlacklist(blacklist)
      if (saved) {
        sendMessageToWebContents(`✅ 已将 "${book.title}" 添加到黑名单 (原因: ${reason})`)
        return { success: true, key: bookKey }
      } else {
        sendMessageToWebContents(`❌ 添加黑名单失败`)
        return { success: false, error: '保存失败' }
      }
    } catch (e) {
      console.log('Add to blacklist error:', e)
      sendMessageToWebContents(`❌ 添加黑名单失败: ${e.message}`)
      return { success: false, error: e.message }
    }
  })

  // 从黑名单中移除项目
  ipcMain.handle('remove-from-blacklist', async (event, bookKey) => {
    try {
      const blacklist = loadBlacklist()
      
      if (blacklist.has(bookKey)) {
        blacklist.delete(bookKey)
        const saved = saveBlacklist(blacklist)
        if (saved) {
          sendMessageToWebContents(`✅ 已从黑名单中移除项目: ${bookKey}`)
          return { success: true }
        } else {
          sendMessageToWebContents(`❌ 移除黑名单项目失败`)
          return { success: false, error: '保存失败' }
        }
      } else {
        return { success: false, error: '项目不在黑名单中' }
      }
    } catch (e) {
      console.log('Remove from blacklist error:', e)
      sendMessageToWebContents(`❌ 移除黑名单项目失败: ${e.message}`)
      return { success: false, error: e.message }
    }
  })

  // 获取黑名单详情
  ipcMain.handle('get-blacklist-details', async (event) => {
    try {
      const blacklist = loadBlacklist()
      const details = Array.from(blacklist.entries()).map(([key, data]) => ({
        key,
        reason: data.reason,
        filename: data.filename,
        fullPath: data.fullPath,
        addedAt: data.addedAt
      }))
      
      return {
        success: true,
        details: details,
        count: blacklist.size
      }
    } catch (e) {
      console.log('Get blacklist details error:', e)
      return { success: false, error: e.message }
    }
  })

  // ==================== 缓存相关处理器 ====================
  
  // 清除标题索引缓存
  ipcMain.handle('clear-title-index-cache', async () => {
    try {
      titleIndexCache.clear()
      sendMessageToWebContents('✅ 标题索引缓存已清除')
      return { success: true }
    } catch (e) {
      console.log('Clear title index cache error:', e)
      return { success: false, error: e.message }
    }
  })

  // 获取标题索引缓存状态
  ipcMain.handle('get-title-index-cache-status', async () => {
    try {
      if (!titleIndexCache.data || !titleIndexCache.timestamp) {
        return {
          success: true,
          cached: false,
          message: '无缓存'
        }
      }
      
      const now = Date.now()
      const age = now - titleIndexCache.timestamp
      const remaining = titleIndexCache.expiryMs - age
      const remainingMinutes = Math.floor(remaining / 60000)
      
      return {
        success: true,
        cached: true,
        dbPath: titleIndexCache.dbPath,
        ageMinutes: Math.floor(age / 60000),
        remainingMinutes,
        titleCount: titleIndexCache.data.titleMap ? titleIndexCache.data.titleMap.size : 0
      }
    } catch (e) {
      console.log('Get cache status error:', e)
      return { success: false, error: e.message }
    }
  })

  console.log('✅ import-sqlite及相关处理器已注册（完整版，包含黑名单和缓存管理）')
}

module.exports = {
  registerImportSqliteFullHandlers
}

