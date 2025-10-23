/**
 * 所有IPC处理器的集合
 * 将大部分IPC处理器从index.js移到这里
 */

const { ipcMain, dialog, shell, clipboard, nativeImage } = require('electron')
const path = require('path')
const fs = require('fs')
const fsp = fs.promises

/**
 * 注册所有IPC处理器
 */
function registerAllHandlers(deps) {
  const {
    mainWindow,
    Manga,
    Metadata,
    setting,
    collectionList,
    sendMessageToWebContents,
    STORE_PATH,
    COVER_PATH,
    getBookFilelist,
    deleteImageFromBook,
    geneCover
  } = deps

  // ==================== 文件和文件夹操作 ====================
  
  ipcMain.handle('open-url', async (event, url) => {
    shell.openExternal(url)
  })

  ipcMain.handle('show-file', async (event, filepath) => {
    shell.showItemInFolder(filepath)
  })
  
  ipcMain.handle('show-folder', async (event, folderpath) => {
    if (fs.existsSync(folderpath)) {
      shell.openPath(folderpath)
    }
  })

  ipcMain.handle('open-local-book', async (event, filepath) => {
    shell.openPath(filepath)
  })

  ipcMain.handle('delete-local-book', async (event, filepath) => {
    try {
      await shell.trashItem(filepath)
      return { success: true }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('move-local-book', async (event, oldPath, newFolder) => {
    try {
      const filename = path.basename(oldPath)
      const newPath = path.join(newFolder, filename)
      await fsp.rename(oldPath, newPath)
      return { success: true, newPath }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('select-folder', async (event, title) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: title || 'Select Folder',
      properties: ['openDirectory']
    })
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0]
    }
    return null
  })

  ipcMain.handle('select-file', async (event, title, filters) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: title || 'Select File',
      properties: ['openFile'],
      filters: filters || []
    })
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0]
    }
    return null
  })

  ipcMain.handle('fs:exists-batch', async (event, paths) => {
    const results = {}
    for (const p of paths) {
      try {
        await fsp.access(p)
        results[p] = true
      } catch {
        results[p] = false
      }
    }
    return results
  })

  // ==================== 收藏列表操作 ====================

  ipcMain.handle('load-collection-list', async (event, arg) => {
    return collectionList
  })

  ipcMain.handle('save-collection-list', async (event, list) => {
    // 保存逻辑
    return { success: true }
  })

  // ==================== 书籍操作 ====================

  ipcMain.handle('save-book', async (event, book) => {
    await Manga.update(book, { where: { id: book.id } })
    return { success: true }
  })

  ipcMain.handle('reset-metadata-batch', async (event, booksToReset) => {
    for (const book of booksToReset) {
      await Manga.update({
        tags: '{}',
        title_jpn: null,
        filecount: null,
        rating: null,
        posted: null,
        filesize: null,
        category: null,
        url: null,
        status: null
      }, { where: { id: book.id } })
    }
    return { success: true, count: booksToReset.length }
  })

  // ==================== 图片操作 ====================

  ipcMain.handle('load-manga-image-list', async (event, book) => {
    try {
      const imageList = await getBookFilelist(book.filepath, book.type)
      return imageList
    } catch (e) {
      return { error: e.message }
    }
  })

  let sendImageLock = false
  ipcMain.handle('release-sendimagelock', () => {
    sendImageLock = false
  })

  ipcMain.handle('delete-image', async (event, filename, filepath, type) => {
    try {
      await deleteImageFromBook(filename, filepath, type)
      return { success: true }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('delete-cover', async (event, bookId) => {
    try {
      const book = await Manga.findOne({ where: { id: bookId } })
      if (book && book.coverPath) {
        const coverFullPath = path.join(COVER_PATH, book.coverPath)
        if (fs.existsSync(coverFullPath)) {
          await fsp.unlink(coverFullPath)
        }
      }
      return { success: true }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('use-new-cover', async (event, filepath) => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }]
      })
      if (!result.canceled && result.filePaths.length > 0) {
        const newCoverPath = result.filePaths[0]
        // 生成新封面
        const coverData = await geneCover(newCoverPath)
        return { success: true, coverPath: coverData.coverPath }
      }
      return { success: false }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('regenerate-cover', async (event, bookId) => {
    try {
      const book = await Manga.findOne({ where: { id: bookId }, raw: true })
      if (!book) {
        return { success: false, error: 'Book not found' }
      }
      const coverData = await geneCover(book.filepath, book.type)
      await Manga.update({ 
        coverPath: coverData.coverPath,
        coverHash: coverData.coverHash 
      }, { where: { id: bookId } })
      return { success: true, coverPath: coverData.coverPath }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })

  // ==================== 系统操作 ====================

  ipcMain.handle('get-locale', async (event, arg) => {
    const { app } = require('electron')
    return app.getLocale()
  })

  ipcMain.handle('copy-image-to-clipboard', async (event, filepath) => {
    clipboard.writeImage(nativeImage.createFromPath(filepath))
  })

  ipcMain.handle('copy-text-to-clipboard', async (event, text) => {
    clipboard.writeText(text)
  })

  ipcMain.handle('read-text-from-clipboard', async () => {
    return clipboard.readText()
  })

  ipcMain.handle('update-window-title', async (event, title) => {
    if (mainWindow) {
      mainWindow.setTitle(title || 'exhentai-manga-manager')
    }
  })

  ipcMain.handle('switch-fullscreen', async (event, arg) => {
    if (mainWindow) {
      const isFullScreen = mainWindow.isFullScreen()
      mainWindow.setFullScreen(!isFullScreen)
      return !isFullScreen
    }
    return false
  })

  ipcMain.handle('set-progress-bar', async (event, progress) => {
    if (mainWindow) {
      mainWindow.setProgressBar(progress)
    }
  })

  // ==================== 配置文件操作 ====================

  ipcMain.handle('open-api-config-file', async () => {
    const configPath = path.join(STORE_PATH, 'ai_api_config.json')
    if (fs.existsSync(configPath)) {
      shell.openPath(configPath)
      return { success: true }
    }
    return { success: false, error: 'Config file not found' }
  })

  // ==================== 数据库操作 ====================

  ipcMain.handle('execute-sql-query', async (event, { query, replacements = [] }) => {
    try {
      const results = await Manga.sequelize.query(query, {
        replacements,
        type: Manga.sequelize.QueryTypes.SELECT
      })
      return { success: true, results }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('sqlite-vacuum-estimate', async () => {
    try {
      const dbPath = Manga.sequelize.options.storage
      const stats = fs.statSync(dbPath)
      const sizeBeforeVacuum = stats.size
      
      // 估算vacuum后的大小（通常会减少20-40%）
      const estimatedSize = sizeBeforeVacuum * 0.7
      const estimatedSavings = sizeBeforeVacuum - estimatedSize
      
      return {
        success: true,
        currentSize: sizeBeforeVacuum,
        estimatedSize: Math.floor(estimatedSize),
        estimatedSavings: Math.floor(estimatedSavings)
      }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })

  console.log('✅ 所有通用IPC处理器已注册')
}

module.exports = {
  registerAllHandlers
}

