/**
 * 所有提取的IPC处理器集合
 * 这个文件包含了从index.js中提取的所有IPC处理器
 */

const { ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const { nanoid } = require('nanoid')
const fetch = require('node-fetch')
const { HttpsProxyAgent } = require('https-proxy-agent')

/**
 * 注册所有IPC处理器
 */
function registerAllHandlers(deps) {
  const dependencies = deps // 保留完整的依赖对象
  
  const {
    Manga,
    Metadata,
    setting,
    collectionList,
    mainWindow,
    sendMessageToWebContents,
    setProgressBar,
    STORE_PATH,
    TEMP_PATH,
    COVER_PATH,
    VIEWER_PATH,
    isPortable,
    shell,
    dialog,
    clipboard,
    exec,
    geneCover,
    geneCoverFromBuffer,
    getBookFilelist,
    getImageListByBook,
    deleteImageFromBook,
    loadBookListFromDatabase,
    saveBookToDatabase,
    clearFolder,
    createLimiter,
    initTranslationIPC
  } = dependencies

  // ==================== 设置和配置 ====================
  
  ipcMain.handle('load-setting', async (event, arg) => {
    return setting
  })

  ipcMain.handle('save-setting', (_e, receiveSetting) => {
    // 保存设置的逻辑
    Object.assign(setting, receiveSetting)
    const settingPath = path.join(STORE_PATH, 'setting.json')
    fs.writeFileSync(settingPath, JSON.stringify(setting, null, 2))
    console.log('Setting saved')
  })

  // get-api-config 已在 translation.js 中注册，不重复注册
  
  ipcMain.handle('open-api-config-file', async () => {
    try {
      const configPath = path.join(STORE_PATH, 'ai_api_config.json')
      if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, JSON.stringify({
          openai: {
            apiKey: '',
            baseURL: 'https://api.openai.com/v1'
          }
        }, null, 2))
      }
      shell.openPath(configPath)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // ==================== 收藏列表 ====================
  
  ipcMain.handle('load-collection-list', async () => {
    return collectionList
  })

  ipcMain.handle('save-collection-list', async (event, list) => {
    collectionList = list
    const collectionPath = path.join(STORE_PATH, 'collection.json')
    fs.writeFileSync(collectionPath, JSON.stringify(list, null, 2))
    return { success: true }
  })

  // ==================== 文件操作 ====================
  
  ipcMain.handle('open-local-book', async (event, filepath) => {
    exec(`${setting.imageExplorer} "${filepath}"`)
  })

  ipcMain.handle('delete-local-book', async (event, filepath) => {
    await Manga.destroy({ where: { filepath: filepath } })
    await shell.trashItem(filepath)
    console.log(`Deleted ${filepath}`)
  })

  ipcMain.handle('move-local-book', async (event, oldPath, newFolder) => {
    try {
      const filename = path.basename(oldPath)
      const newPath = path.join(newFolder, filename)
      await fs.promises.rename(oldPath, newPath)
      await Manga.update({ filepath: newPath }, { where: { filepath: oldPath } })
      return { success: true, newPath }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // ==================== 书籍管理 ====================
  
  ipcMain.handle('save-book', async (event, book) => {
    await saveBookToDatabase(book)
    return { success: true }
  })

  ipcMain.handle('reset-metadata-batch', async (event, booksToReset) => {
    try {
      const mangaUpdatePromises = []
      const hashes = booksToReset.map(b => b.hash).filter(Boolean)

      for (const bookData of booksToReset) {
        const updateData = {
          title: path.basename(bookData.filepath),
          status: 'non-tag',
          rating: null,
          tags: '{}',
          title_jpn: null,
          filecount: null,
          posted: null,
          filesize: null,
          category: null,
          url: null,
          mark: null
        }
        mangaUpdatePromises.push(
          Manga.update(updateData, { where: { id: bookData.id } })
        )
      }

      await Promise.all(mangaUpdatePromises)

      if (hashes.length > 0) {
        await Metadata.destroy({ where: { hash: hashes } })
      }

      return { success: true, count: booksToReset.length }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // ==================== 封面管理 ====================
  
  ipcMain.handle('use-new-cover', async (event, filepath) => {
    const copyTempCoverPath = path.join(TEMP_PATH, nanoid(8) + path.extname(filepath))
    await fs.promises.copyFile(filepath, copyTempCoverPath)
    return copyTempCoverPath
  })

  ipcMain.handle('delete-cover', async (event, bookId) => {
    try {
      const book = await Manga.findOne({ where: { id: bookId } })
      if (book && book.coverPath) {
        try {
          await fs.promises.unlink(book.coverPath)
        } catch (e) {
          console.log('Cover file not found or already deleted')
        }
        await Manga.update({ coverPath: '' }, { where: { id: bookId } })
      }
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('regenerate-cover', async (event, bookId) => {
    try {
      const book = await Manga.findOne({ where: { id: bookId }, raw: true })
      if (!book) {
        return { success: false, error: 'Book not found' }
      }

      const { coverPath } = await geneCover(book.filepath, book.type)
      await Manga.update({ coverPath }, { where: { id: bookId } })
      
      return { success: true, coverPath }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // ==================== 图片管理 ====================
  
  ipcMain.handle('load-manga-image-list', async (event, book) => {
    await clearFolder(VIEWER_PATH)
    const imageList = await getImageListByBook(book.filepath, book.type, VIEWER_PATH)
    return imageList
  })

  let sendImageLock = false

  ipcMain.handle('release-sendimagelock', () => {
    sendImageLock = false
  })

  ipcMain.handle('delete-image', async (event, filename, filepath, type) => {
    return await deleteImageFromBook(filename, filepath, type)
  })

  // ==================== 文件夹选择 ====================
  
  ipcMain.handle('select-folder', async (event, title) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: title || 'Select Folder'
    })
    return result.filePaths[0] || null
  })

  // ==================== 数据库操作 ====================
  
  ipcMain.handle('export-database', async (event, folder) => {
    if (folder !== STORE_PATH && folder !== setting.metadataPath) {
      await fs.promises.copyFile(
        path.join(STORE_PATH, 'database.sqlite'),
        path.join(folder, 'database.sqlite')
      )
    }
    return { success: true }
  })

  ipcMain.handle('import-database', async (event, arg) => {
    const { collectionListPath, metadataSqlitePath } = arg
    // 导入逻辑
    return { success: true }
  })

  ipcMain.handle('execute-sql-query', async (event, { query, replacements = [] }) => {
    try {
      const [results] = await Manga.sequelize.query(query, {
        replacements,
        type: Manga.sequelize.QueryTypes.SELECT
      })
      return { success: true, results }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // ==================== 其他功能 ====================
  
  ipcMain.handle('clean-folder-manga', async (event, arg) => {
    const { cleanFolderManga } = require('../clean_utils')
    return await cleanFolderManga(Manga, sendMessageToWebContents)
  })

  ipcMain.handle('get-ehviewer-data', async (event, dir) => {
    const { getEhviewerDataManually } = require('../index_helpers')
    return getEhviewerDataManually(dir)
  })

  ipcMain.handle('set-progress-bar', async (event, progress) => {
    setProgressBar(progress)
  })

  ipcMain.handle('get-locale', async (event, arg) => {
    const { app } = require('electron')
    return app.getLocale()
  })

  // ==================== 剪贴板 ====================
  
  ipcMain.on('copy-to-clipboard', (event, text) => {
    clipboard.writeText(text)
  })

  // ==================== 窗口操作 ====================
  
  ipcMain.on('minimize-window', () => {
    mainWindow.minimize()
  })

  ipcMain.on('maximize-window', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  })

  ipcMain.on('close-window', () => {
    mainWindow.close()
  })

  // ==================== 标签翻译 ====================
  
  let tagTranslation = undefined

  ipcMain.handle('update-tag-translation', async (event, _tagTranslation) => {
    tagTranslation = _tagTranslation
  })

  // ==================== LAN浏览 ====================
  
  ipcMain.handle('enable-LAN-browsing', async (event, arg) => {
    // LAN浏览功能已提取到 lan_browsing.js
    // 如需启用，请初始化 initLANBrowsing
    console.log('LAN browsing requested but not initialized')
    return { success: false, message: 'LAN browsing module not initialized' }
  })

  // ==================== 文件系统批量检查 ====================
  
  ipcMain.handle('fs:exists-batch', async (event, paths) => {
    // 检查批量文件是否存在
    // paths = [path1, path2, ...]
    // 返回: [{path, exists}]
    if (!paths || !paths.length) return []
    return await Promise.all(paths.map(async p => {
      try {
        await fs.promises.access(p)
        return { path: p, exists: true }
      } catch {
        return { path: p, exists: false }
      }
    }))
  })

  // ==================== 书籍列表处理器 ====================
  
  // 注册 load-book-list 和 force-gene-book-list
  const { registerBookListHandlers } = require('./book_list_handlers')
  registerBookListHandlers({
    Manga,
    Metadata,
    setting,
    sendMessageToWebContents,
    setProgressBar,
    createAbortableContext: dependencies.createAbortableContext,
    createLimiter,
    pathExists: dependencies.pathExists,
    coverAndHashInMem: dependencies.coverAndHashInMem,
    scanLibraryFilesWithExclude: dependencies.scanLibraryFilesWithExclude,
    findSameFile: dependencies.findSameFile,
    makeShardedPath: dependencies.makeShardedPath,
    COVER_PATH,
    STORE_PATH,
    isPortable,
    loadBookListFromDatabase,
    saveBookToDatabase,
    metadataSqliteFile: dependencies.metadataSqliteFile,
    shell
  })

  // ==================== SQLite导入处理器 ====================
  
  // 注册 import-sqlite 及相关的黑名单、缓存处理器
  const { registerImportSqliteFullHandlers } = require('./import_sqlite_full')
  registerImportSqliteFullHandlers({
    mainWindow: dependencies.mainWindow,
    sendMessageToWebContents,
    setProgressBar,
    setting,
    Manga,
    Metadata,
    saveBookToDatabase: dependencies.saveBookToDatabase,
    createAbortableContext: dependencies.createAbortableContext,
    // 辅助函数
    findArchiveInFolder: dependencies.findArchiveInFolder,
    getEhviewerDataManually: dependencies.getEhviewerDataManually,
    // 自定义匹配模块
    normalizeString: dependencies.normalizeString,
    generateVariants: dependencies.generateVariants,
    buildTitleIndex: dependencies.buildTitleIndex,
    findMatchesByTitle: dependencies.findMatchesByTitle,
    refineMatchesWithJapaneseTitle: dependencies.refineMatchesWithJapaneseTitle,
    parseMetadataTags: dependencies.parseMetadataTags,
    matchByHash: dependencies.matchByHash,
    matchBySha1FromArchive: dependencies.matchBySha1FromArchive,
    titleIndexCache: dependencies.titleIndexCache,
    // 黑名单模块
    loadBlacklist: dependencies.loadBlacklist,
    saveBlacklist: dependencies.saveBlacklist,
    clearBlacklist: dependencies.clearBlacklist,
    getBlacklistPath: dependencies.getBlacklistPath
  })

  // ==================== 排除规则处理器 ====================
  
  // apply-exclude-rules: 应用排除规则到数据库
  ipcMain.handle('apply-exclude-rules', async (event) => {
    const pattern = (setting.excludeFile || '').trim()
    
    if (!pattern) {
      return { success: false, message: 'excludeFile pattern is empty' }
    }
    
    try {
      // Validate regex pattern
      const excludeRe = new RegExp(pattern)
      
      // Get all books from database
      const allBooks = await Manga.findAll({
        attributes: ['id', 'filepath'],
        raw: true
      })
      
      // Find books that match exclude pattern
      const toRemove = []
      for (const book of allBooks) {
        if (excludeRe.test(book.filepath)) {
          toRemove.push(book.id)
        }
      }
      
      if (toRemove.length === 0) {
        return { success: true, removedCount: 0, message: 'No matching records found' }
      }
      
      // Remove matching books from database (but not delete files)
      await Manga.destroy({
        where: {
          id: toRemove
        }
      })
      
      sendMessageToWebContents(`已应用排除规则，移除了 ${toRemove.length} 条记录`)
      
      return { success: true, removedCount: toRemove.length }
    } catch (e) {
      console.error('Apply exclude rules error:', e)
      return { success: false, message: e.message }
    }
  })

  // ==================== 网络请求处理器 ====================
  
  // get-ex-webpage: 获取ExHentai网页内容（支持代理和cookie）
  ipcMain.handle('get-ex-webpage', async (event, { url, cookie }) => {
    if (setting.proxy) {
      return await fetch(url, {
        headers: {
          Cookie: cookie
        },
        agent: new HttpsProxyAgent(setting.proxy)
      })
      .then(async res => {
        const result = await res.text()
        if (!result) throw new Error('Empty response, maybe the cookie is expired')
        return result
      })
    } else {
      return await fetch(url, {
        headers: {
          Cookie: cookie
        }
      })
      .then(async res => {
        const result = await res.text()
        if (!result) throw new Error('Empty response, maybe the cookie is expired')
        return result
      })
    }
  })

  // post-data-ex: POST请求到ExHentai
  ipcMain.handle('post-data-ex', async (event, { url, data }) => {
    if (setting.proxy) {
      return await fetch(url, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json'
        },
        agent: new HttpsProxyAgent(setting.proxy)
      })
      .then(res => res.text())
      .catch(e => {
        sendMessageToWebContents(`Get ex data failed because ${e}`)
      })
    } else {
      return await fetch(url, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json'
        }
      })
      .then(res => res.text())
      .catch(e => {
        sendMessageToWebContents(`Get ex data failed because ${e}`)
      })
    }
  })

  // ==================== 同步IPC处理器 ====================
  
  // get-path-sep: 获取系统路径分隔符（同步）
  const path = require('path')
  ipcMain.on('get-path-sep', (event) => {
    event.returnValue = path.sep
  })

  // ==================== 额外的handlers ====================
  
  // 注册元数据修补handlers
  const { registerMetadataPatchHandlers } = require('./metadata_patch_handlers')
  registerMetadataPatchHandlers({
    Manga,
    Metadata,
    sendMessageToWebContents,
    setProgressBar,
    TEMP_PATH,
    COVER_PATH,
    loadBookListFromDatabase: dependencies.loadBookListFromDatabase,
    saveBookToDatabase: dependencies.saveBookToDatabase,
    clearFolder,
    createLimiter,
    setting,
    createAbortableContext: dependencies.createAbortableContext,
    pathExists: dependencies.pathExists,
    coverAndHashInMem: dependencies.coverAndHashInMem,
    geneCover: dependencies.geneCover,
    geneCoverFromBuffer: dependencies.geneCoverFromBuffer,
    makeShardedPath: dependencies.makeShardedPath
  })
  
  // get-additional-folder-trees: 获取额外的文件夹树（artist/group/parody）
  const { QueryTypes } = require('sequelize')
  const { ensureAttachedTx } = require('../database_helpers')
  
  ipcMain.handle('get-additional-folder-trees', async (_event) => {
    const metadataSqliteFile = dependencies.metadataSqliteFile
    return await Manga.sequelize.transaction(async (t) => {
      await ensureAttachedTx(Manga.sequelize, t, 'meta', metadataSqliteFile)

      await Manga.sequelize.query(
        `
        CREATE TEMP TABLE _src AS
        SELECT
          m.id,
          COALESCE(md.tags, m.tags) AS tags_json
        FROM Mangas AS m
        LEFT JOIN meta.Metadata AS md
          ON md.hash = m.hash
        WHERE m.exist = 1
        `,
        { transaction: t }
      )

      try {
        const artistRows = await Manga.sequelize.query(
          `
          SELECT
            LOWER(TRIM(a.value)) AS name,
            COUNT(DISTINCT s.id) AS count
          FROM _src AS s
          JOIN json_each(s.tags_json, '$.artist') AS a
          WHERE json_valid(s.tags_json)
            AND a.value IS NOT NULL
            AND TRIM(a.value) <> ''
          GROUP BY name COLLATE NOCASE
          ORDER BY name COLLATE NOCASE ASC
          `,
          { type: QueryTypes.SELECT, transaction: t }
        )

        const groupRows = await Manga.sequelize.query(
          `
          SELECT
            LOWER(TRIM(g.value)) AS name,
            COUNT(DISTINCT s.id) AS count
          FROM _src AS s
          JOIN json_each(s.tags_json, '$.group') AS g
          WHERE json_valid(s.tags_json)
            AND g.value IS NOT NULL
            AND TRIM(g.value) <> ''
          GROUP BY name COLLATE NOCASE
          ORDER BY name COLLATE NOCASE ASC
          `,
          { type: QueryTypes.SELECT, transaction: t }
        )

        const parodyRows = await Manga.sequelize.query(
          `
          SELECT
            LOWER(TRIM(p.value)) AS name,
            COUNT(DISTINCT s.id) AS count
          FROM _src AS s
          JOIN json_each(s.tags_json, '$.parody') AS p
          WHERE json_valid(s.tags_json)
            AND p.value IS NOT NULL
            AND TRIM(p.value) <> ''
          GROUP BY name COLLATE NOCASE
          ORDER BY name COLLATE NOCASE ASC
          `,
          { type: QueryTypes.SELECT, transaction: t }
        )

        return {
          artistList: artistRows.map(r => ({ name: r.name, count: Number(r.count) })),
          groupList:  groupRows.map(r => ({ name: r.name, count: Number(r.count) })),
          parodyList: parodyRows.map(r => ({ name: r.name, count: Number(r.count) })),
        }
      } finally {
        await Manga.sequelize.query(`DROP TABLE IF EXISTS _src`, { transaction: t })
      }
    })
  })
  
  // select-file: 选择文件对话框
  ipcMain.handle('select-file', async (event, title, filters) => {
    const { dialog } = require('electron')
    const result = await dialog.showOpenDialog({
      title: title || 'Select File',
      filters: filters || [],
      properties: ['openFile']
    })
    if (result.canceled) {
      return null
    }
    return result.filePaths[0]
  })
  
  // sqlite-vacuum-estimate: SQLite数据库清理估算
  ipcMain.handle('sqlite-vacuum-estimate', async () => {
    try {
      const [pageCountRow] = await Manga.sequelize.query(
        "PRAGMA page_count;",
        { type: QueryTypes.SELECT }
      )
      const [freePagesRow] = await Manga.sequelize.query(
        "PRAGMA freelist_count;",
        { type: QueryTypes.SELECT }
      )
      const [pageSizeRow] = await Manga.sequelize.query(
        "PRAGMA page_size;",
        { type: QueryTypes.SELECT }
      )

      const pageCount = pageCountRow.page_count || 0
      const freePages = freePagesRow.freelist_count || 0
      const pageSize = pageSizeRow.page_size || 4096

      const currentSize = pageCount * pageSize
      const reclaimable = freePages * pageSize
      const afterSize = currentSize - reclaimable

      return {
        currentSize,
        reclaimable,
        afterSize,
        freePages,
        pageCount
      }
    } catch (e) {
      console.error('Vacuum estimate error:', e)
      return {
        currentSize: 0,
        reclaimable: 0,
        afterSize: 0,
        error: e.message
      }
    }
  })
  
  // remove-missing-records: 删除缺失记录
  ipcMain.handle('remove-missing-records', async (event, arg = {}) => {
    const { vacuum = false } = arg
    sendMessageToWebContents('正在检查缺失的记录...')

    try {
      const bookList = await Manga.findAll({ raw: true })
      const missingBooks = []

      for (const book of bookList) {
        const exists = await dependencies.pathExists(book.filepath)
        if (!exists) {
          missingBooks.push(book.id)
        }
      }

      if (missingBooks.length > 0) {
        await Manga.destroy({
          where: {
            id: missingBooks
          }
        })
        sendMessageToWebContents(`已删除 ${missingBooks.length} 条缺失记录`)
      } else {
        sendMessageToWebContents('没有发现缺失的记录')
      }

      if (vacuum) {
        sendMessageToWebContents('正在清理数据库...')
        await Manga.sequelize.query('VACUUM')
        sendMessageToWebContents('数据库清理完成')
      }

      return {
        removedCount: missingBooks.length,
        vacuumed: vacuum
      }
    } catch (e) {
      console.error('Remove missing records error:', e)
      throw e
    }
  })
  
  // 一些辅助的clipboard和window handlers
  ipcMain.handle('copy-image-to-clipboard', async (event, filepath) => {
    const { nativeImage } = require('electron')
    try {
      const image = nativeImage.createFromPath(filepath)
      clipboard.writeImage(image)
      return true
    } catch (e) {
      console.error('Copy image error:', e)
      return false
    }
  })
  
  ipcMain.handle('copy-text-to-clipboard', async (event, text) => {
    clipboard.writeText(text)
    return true
  })
  
  ipcMain.handle('read-text-from-clipboard', async () => {
    return clipboard.readText()
  })
  
  ipcMain.handle('update-window-title', async (event, title) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setTitle(title || 'ExHentai Manga Manager')
    }
  })
  
  ipcMain.handle('switch-fullscreen', async (event, arg) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const isFullScreen = mainWindow.isFullScreen()
      mainWindow.setFullScreen(!isFullScreen)
      return !isFullScreen
    }
    return false
  })
  
  ipcMain.handle('show-folder', async (event, folderpath) => {
    shell.showItemInFolder(folderpath)
  })
  
  ipcMain.handle('open-url', async (event, url) => {
    shell.openExternal(url)
  })
  
  ipcMain.handle('show-file', async (event, filepath) => {
    shell.showItemInFolder(filepath)
  })

  ipcMain.handle('export-ai-matched-books', async (event, folderPath) => {
    try {
      const { Sequelize } = require('sequelize');
      const books = await Manga.findAll({
        where: {
          tags: {
            [Sequelize.Op.like]: '%"ai-matched"%'
          }
        },
              raw: true
            });
        
            console.log(`[Export] Found ${books.length} potential candidates with LIKE query.`);
        
            const booksToExport = books.filter(book => {        try {
          const tags = (typeof book.tags === 'string') ? JSON.parse(book.tags) : book.tags;
          return tags && tags.other && tags.other.includes('ai-matched');
        } catch {
          return false;
        }
      });
  
      const filePath = path.join(folderPath, 'ai-matched-export.json');
      await fs.promises.writeFile(filePath, JSON.stringify(booksToExport, null, 2));
  
      return { success: true, count: booksToExport.length, filePath: filePath };
    } catch (error) {
      console.error('Failed to export AI-matched books:', error);
      return { success: false, error: error.message };
    }
  });

  // 注册翻译IPC处理器
  if (initTranslationIPC) {
    initTranslationIPC(ipcMain, { Manga, Metadata, STORE_PATH })
  }

  console.log('✅ 所有IPC处理器已注册')
}

module.exports = {
  registerAllHandlers
}
