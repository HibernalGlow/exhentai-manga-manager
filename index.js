const {
  app,
  BrowserWindow,
  ipcMain,
  session,
  dialog,
  shell,
  screen,
  Menu,
  clipboard,
  nativeImage,
  Tray,
  webContents,
  WebContentsView,
  net
} = require('electron')
const path = require('path')
const os = require('os')
const fs = require('fs')
const fsp = fs.promises
const zlib = require('zlib');
const { brotliDecompress } = require('zlib')
const { promisify, format } = require('util')
const _ = require('lodash')
const { nanoid } = require('nanoid')
const sharp = require('sharp')
const { exec } = require('child_process')
const { createHash } = require('crypto')
const sqlite3 = require('sqlite3')
const { open } = require('sqlite')
const { pack, unpack } = require('msgpackr');

const fetch = require('node-fetch')
const { HttpsProxyAgent } = require('https-proxy-agent')
const windowStateKeeper = require('electron-window-state')
const express = require('express')
const { performance } = require('node:perf_hooks')
const { prepareMangaModel, prepareMetadataModel, ensureMetaTable, installRevTriggers } = require('./modules/database')
const { prepareTemplate } = require('./modules/prepare_menu.js')
const {
  getBookFilelist,
  geneCover,
  geneCoverFromBuffer,
  getImageListByBook,
  deleteImageFromBook
} = require('./fileLoader/index.js')
const {
  STORE_PATH,
  isPortable,
  TEMP_PATH,
  COVER_PATH,
  VIEWER_PATH,
  prepareSetting,
  prepareCollectionList,
  preparePath
} = require('./modules/init_folder_setting.js')
const { findSameFile, makeShardedPath } = require('./fileLoader/folder.js')
const { ElectronBlocker } = require('@ghostery/adblocker-electron')
const { QueryTypes } = require("sequelize");

// ==================== 自定义功能模块 ====================
// @CUSTOM: 本地自定义功能，合并时需要保留
const { 
  normalizeString, 
  calculateSimilarity,
  generateVariants,
  buildTitleIndex,
  findMatchesByTitle,
  refineMatchesWithJapaneseTitle,
  parseMetadataTags,
  matchByHash,
  matchBySha1FromArchive,
  titleIndexCache
} = require('./modules/custom_sqlite_import')

const {
  loadBlacklist,
  saveBlacklist,
  clearBlacklist,
  getBlacklistPath
} = require('./modules/custom_blacklist')

const { cleanFolderManga } = require('./modules/clean_utils')

// 辅助函数模块
const {
  createAbortableContext,
  createLimiter,
  pathExists,
  findArchiveInFolder,
  getEhviewerDataManually,
  coverAndHashInMem,
  compareItems,
  formatTags,
  scanLibraryFilesWithExclude
} = require('./modules/index_helpers')

// IPC 处理器注册模块 - 需要在顶部导入以确保打包后正确加载
const { registerAllHandlers } = require('./modules/ipc_handlers/all_handlers')
const { registerFolderBatchHandlers } = require('./modules/ipc_handlers/folder_batch_handlers')
const { registerAiTagHandlers } = require('./modules/ipc_handlers/ai_tag_handlers')

// ==================== 自定义功能模块结束 ====================

preparePath()

// ==================== 初始化和配置 ====================
// 检查STORE_PATH是否正确初始化
console.log('🔍 检查STORE_PATH状态:')
console.log('  STORE_PATH:', STORE_PATH)
console.log('  isPortable:', isPortable)
console.log('  TEMP_PATH:', TEMP_PATH)
console.log('  COVER_PATH:', COVER_PATH)
console.log('  VIEWER_PATH:', VIEWER_PATH)

// 验证路径是否存在
try {
  fs.accessSync(STORE_PATH)
  console.log('  ✅ STORE_PATH 存在')
} catch (e) {
  console.error('  ❌ STORE_PATH 不存在:', e.message)
}

try {
  fs.accessSync(TEMP_PATH)
  console.log('  ✅ TEMP_PATH 存在')
} catch (e) {
  console.error('  ❌ TEMP_PATH 不存在:', e.message)
}

let setting = prepareSetting()
let collectionList = prepareCollectionList()

// 在路径初始化之后再加载翻译模块，确保 STORE_PATH 已被正确设置
const { initTranslationIPC } = require('./modules/translation.js')

const Manga = prepareMangaModel(path.join(STORE_PATH, './database.sqlite'))
let metadataSqliteFile
if (setting.metadataPath) {
  metadataSqliteFile = path.join(setting.metadataPath, './metadata.sqlite')
} else {
  metadataSqliteFile = path.join(STORE_PATH, './metadata.sqlite')
}
let Metadata = prepareMetadataModel(metadataSqliteFile)


const getColumns = async (sequelize, tableName) => {
      const query = `PRAGMA table_info(${tableName})`
      const [results] = await sequelize.query(query)
      return results.map(column => column.name)
    }

// 数据库初始化 Promise - 确保在使用前完成初始化
const databaseInitPromise = (async () => {
  try {
    console.log('🔄 开始数据库初始化...')
    
    await Manga.sequelize.query(`PRAGMA journal_mode=WAL;`)
    await Metadata.sequelize.query(`PRAGMA journal_mode=WAL;`)

    const columns = await getColumns(Manga.sequelize, 'Mangas')
    if (['hiddenBook', 'readCount'].some(c => !columns.includes(c))) {
      await Manga.sync({ alter: true })
    } else {
      await Manga.sync()
    }
    await Metadata.sync()
    await Manga.sequelize.query(`CREATE INDEX IF NOT EXISTS manga_hash_index ON Mangas (hash)`)

    // add meta table for cache
    await ensureMetaTable(Manga.sequelize)
    await installRevTriggers(Manga.sequelize, 'Mangas', 'mm')

    await ensureMetaTable(Metadata.sequelize)
    await installRevTriggers(Metadata.sequelize, 'Metadata', 'mm')

    console.log('✅ 数据库初始化完成')
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error)
    throw error
  }
})()

const logFile = fs.createWriteStream(path.join(STORE_PATH, 'log.txt'), { flags: 'w' })
const logStdout = process.stdout
const logStderr = process.stderr

console.log = (...message) => {
  logFile.write(format(...message) + '\n')
  logStdout.write(format(...message) + '\n')
}

console.error = (...message) => {
  logFile.write(format(...message) + '\n')
  logStderr.write(format(...message) + '\n')
}

process
    .on('unhandledRejection', (reason, promise) => {
      console.log('Unhandled Rejection at:', promise, 'reason:', reason)
    })
    .on('uncaughtException', err => {
      console.log(err, 'Uncaught Exception thrown')
      process.exit(1)
    })

// ==================== 窗口和UI管理 ====================

const sendMessageToWebContents = (message) => {
  console.log(message)
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('send-message', message)
  }
}

let mainWindow
let tray
let screenWidth
let sendImageLock = false

const createTray = () => {
  if (tray) return
  const iconPath = path.join(__dirname, 'public/icon.png')
  tray = new Tray(iconPath)
  tray.setToolTip('exhentai-manga-manager')
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible() && !mainWindow.isMinimized()) {
        mainWindow.minimize()
      } else if (mainWindow.isMinimized()) {
        mainWindow.restore()
        mainWindow.setSkipTaskbar(false)
        mainWindow.focus()
      } else {
        mainWindow.show()
        mainWindow.setSkipTaskbar(false)
        mainWindow.focus()
      }
    }
  })
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'show window',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) {
            mainWindow.restore()
          } else {
            mainWindow.show()
          }
          mainWindow.setSkipTaskbar(false)
          mainWindow.focus()
        }
      }
    },
    {
      label: 'exit',
      click: () => {
        mainWindow.close()
      }
    }
  ])
  tray.setContextMenu(contextMenu)
}

const createWindow = () => {
  const mainWindowState = windowStateKeeper({
    defaultWidth: 1560,
    defaultHeight: 1000
  })
  const win = new BrowserWindow({
    'x': mainWindowState.x,
    'y': mainWindowState.y,
    'width': mainWindowState.width,
    'height': mainWindowState.height,
    webPreferences: {
      webSecurity: app.isPackaged ? true : false,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false,  // 禁用沙盒以支持软连接目录
      nodeIntegration: false,
      contextIsolation: true
    },
    show: false
  })
  if (app.isPackaged) {
    win.loadFile('dist/index.html')
  } else {
    win.loadURL('http://localhost:5374')
  }
  win.setMenuBarVisibility(false)
  win.setAutoHideMenuBar(true)
  const menu = Menu.buildFromTemplate(prepareTemplate(win))
  Menu.setApplicationMenu(menu)
  win.webContents.on('did-finish-load', () => {
    const name = require('./package.json').name
    const version = require('./package.json').version
    win.setTitle(name + ' ' + version)
  })
  win.once('ready-to-show', () => {
    if (setting.minimizeOnStart) {
      if (setting.minimizeToTray) {
        createTray()
        win.hide()
        win.setSkipTaskbar(true)
      } else {
        win.minimize()
      }
    } else {
      win.show()
    }
  })
  win.on('minimize', (event) => {
    if (setting.minimizeToTray) {
      event.preventDefault()
      createTray()
      win.hide()
      win.setSkipTaskbar(true)
    }
  })
  win.on('restore', () => {
    win.show()
    win.setSkipTaskbar(false)
  })
  win.on('show', () => {
    win.setSkipTaskbar(false)
    mainWindowState.manage(win)
  })

  win.on('app-command', (_ev, cmd) => {
    const target = webContents.getFocusedWebContents()
    if (!target) return
    if (cmd === 'browser-backward' && target.navigationHistory.canGoBack?.()) {
      target.navigationHistory.goBack()
    } else if (cmd === 'browser-forward' && target.navigationHistory.canGoForward?.()) {
      target.navigationHistory.goForward()
    }
  })

  return win
}

app.commandLine.appendSwitch('js-flags', '--max-old-space-size=65536')
// 禁用网络沙盒以支持软连接目录（如使用 mklink 创建的符号链接）
app.commandLine.appendSwitch('--no-sandbox')
app.commandLine.appendSwitch('--disable-features', 'NetworkServiceSandbox')

// app.disableHardwareAcceleration()

async function setupAdblockAndGuards() {
  const ses = session.fromPartition('persist:eh-search')

  // 1) Adblock lists (add annoyance lists to catch overlays/in-page popups)
  const blocker = await ElectronBlocker.fromLists(fetch, [
    'https://easylist.to/easylist/easylist.txt',
    'https://easylist.to/easylist/easyprivacy.txt',
    'https://secure.fanboy.co.nz/fanboy-annoyance.txt',
    // 'https://ublockorigin.github.io/uAssets/filters/annoyances.txt',
  ], { enableCompression: true })

  blocker.enableBlockingInSession(ses)

  // 2) Deny permission prompts (notifications are a common nuisance pop)
  ses.setPermissionRequestHandler((_wc, _permission, callback) => {
    // Return false for everything by default (tighten later if needed)
    callback(false)
  })

  // 3) Disable Additional Popups/Windows
  app.on('web-contents-created', (_event, contents) => {
    return { action: 'deny' }
  })
}

app.whenReady().then(async () => {
  try {
    console.log('🚀 应用启动中...')
    
    // 1. 首先等待数据库初始化完成
    console.log('⏳ 等待数据库初始化完成...')
    await databaseInitPromise
    
    // 2. 然后注册所有IPC处理器（在创建窗口之前）
    console.log('📝 注册IPC处理器...')
    const setProgressBar = (progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setProgressBar(progress)
        mainWindow.webContents.send('send-action', {
          action: 'send-progress',
          progress
        })
      }
    }

    registerAllHandlers({
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
      metadataSqliteFile,
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
      saveBookToDatabase: (book) => saveBookToDatabase(Manga, Metadata, book),
      clearFolder,
      createLimiter,
      initTranslationIPC,
      // 从 index_helpers 导入的函数
      createAbortableContext,
      pathExists,
      coverAndHashInMem,
      scanLibraryFilesWithExclude,
      findArchiveInFolder,
      getEhviewerDataManually,
      // 从 fileLoader/folder.js 导入的函数
      findSameFile,
      makeShardedPath,
      // 从 custom_sqlite_import 导入的函数
      normalizeString,
      calculateSimilarity,
      generateVariants,
      buildTitleIndex,
      findMatchesByTitle,
      refineMatchesWithJapaneseTitle,
      parseMetadataTags,
      matchByHash,
      matchBySha1FromArchive,
      titleIndexCache,
      // 从 custom_blacklist 导入的函数
      loadBlacklist,
      saveBlacklist,
      clearBlacklist,
      getBlacklistPath,
      isInBlacklist: require('./modules/custom_blacklist').isInBlacklist,
      addToBlacklist: require('./modules/custom_blacklist').addToBlacklist
    })
    
    // 注册文件夹批量操作处理器
    registerFolderBatchHandlers({
      db: Manga,
      mainWindow,
      saveBookToDatabase: (book) => saveBookToDatabase(Manga, Metadata, book)
    })
    
    // 注册 AI 标签处理器
    // Load translations for AI tagger
    const { initTranslations } = require('./src/services/translationLoader.js')
    console.log('🔄 加载标签翻译数据以增强AI匹配...');
    const translationPayload = await initTranslations(STORE_PATH);
    if (translationPayload && translationPayload.data) {
      console.log(`✅ 成功加载 ${Object.keys(translationPayload.data).length} 个分类的翻译数据。`);
    } else {
      console.warn('⚠️ 未能加载标签翻译数据，AI标签匹配将仅基于现有标签。');
    }

    registerAiTagHandlers({
      Manga,
      Metadata,
      setting,
      collectionList,
      mainWindow,
      sendMessageToWebContents,
      STORE_PATH,
      translationData: translationPayload ? translationPayload.data : null
    })
    
    // 3. 最后创建窗口
    console.log('🪟 创建主窗口...')
    // await setupAdblockAndGuards()
    const primaryDisplay = screen.getPrimaryDisplay()
    screenWidth = Math.floor(primaryDisplay.workAreaSize.width * primaryDisplay.scaleFactor)
    mainWindow = createWindow()
    
    console.log('✅ 应用启动完成')
  } catch (error) {
    console.error('❌ 应用启动失败:', error)
    app.quit()
  }
})
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createWindow()
  }
})

app.on('ready', async () => {
  if (setting.proxy) {
    await session.defaultSession.setProxy({
      mode: 'fixed_servers',
      proxyRules: setting.proxy
    })
  }
  // session.defaultSession.loadExtension(path.join(__dirname, './devtools'))
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async (e,) => {
  e.preventDefault()
  try {
    // 缓存保存功能已移至 wcv_and_cache.js 模块
    // 如需启用，请初始化 initWCVAndCache 并在此处调用
    console.log('Application quitting...')
  } catch (err) {
    console.log('Error during quit:', err)
  } finally {
    app.exit(0)
  }
})


process.on('exit', () => {
  app.quit()
})


// base function

// ==================== 数据库辅助函数 已提取到 modules/database_helpers.js ====================
const {
  loadBookListFromBrFile,
  loadLegecyBookListFromFile,
  ensureAttachedTx,
  markMissingBooksStatus,
  loadBookListFromDatabase,
  saveBookListToDatabase,
  saveBookToDatabase,
  clearFolder
} = require('./modules/database_helpers')



// ==================== 核心IPC处理器 - 库和元数据管理 ====================
/**=========    library and metadata  ================*/
// helpers for parallel scan
// Small concurrency limiter (p-limit style) with zero deps
// ==================== 辅助函数已移至 modules/index_helpers.js ====================


// main function

// ==================== load-book-list 已提取到 modules/ipc_handlers/book_list_handlers.js ====================
// 原处理器约196行，负责扫描库并加载书籍列表


// ==================== force-gene-book-list 已提取到 modules/ipc_handlers/book_list_handlers.js ====================
// 原处理器约238行，负责强制重建整个书籍列表



// ==================== 所有IPC处理器 已提取到独立模块 ====================
// 原代码约1182行，包括36个IPC处理器
// IPC处理器在 app.whenReady() 中注册（见上方第368-408行）




/*  ===== for sub browser in the search page  =====
* Use the WebContentsView API to embed a web page in the main browser
*  in SearchDialog.vue
* */

// Track WebContentsView instances by id (e.g., "search-dialog")

// ==================== WebContentsView和缓存管理 已提取到 modules/wcv_and_cache.js ====================
// 原代码约525行，包括wcv IPC处理器、searchSessionFetchUrl和缓存相关功能
// 使用 const { initWCVAndCache } = require('./modules/wcv_and_cache') 来启用
