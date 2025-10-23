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
      const configPath = path.join(STORE_PATH, 'api-config.json')
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

  // 注册翻译IPC处理器
  if (initTranslationIPC) {
    initTranslationIPC(ipcMain, { Manga, Metadata, STORE_PATH })
  }

  console.log('✅ 所有IPC处理器已注册')
}

module.exports = {
  registerAllHandlers
}
