/**
 * 应用核心 - 窗口管理和应用生命周期
 * 从index.js提取，减少主文件行数
 */

const { app, BrowserWindow, Tray, Menu, screen, ipcMain } = require('electron')
const path = require('path')
const windowStateKeeper = require('electron-window-state')

let mainWindow = null
let tray = null

/**
 * 创建系统托盘
 */
function createTray() {
  if (tray) return
  
  const iconPath = path.join(__dirname, '../public/icon.png')
  tray = new Tray(iconPath)
  tray.setToolTip('exhentai-manga-manager')
  
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide()
      } else {
        mainWindow.show()
      }
    }
  })
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show', click: () => mainWindow?.show() },
    { label: 'Hide', click: () => mainWindow?.hide() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ])
  
  tray.setContextMenu(contextMenu)
}

/**
 * 创建主窗口
 */
function createWindow(setting) {
  const mainWindowState = windowStateKeeper({
    defaultWidth: 1600,
    defaultHeight: 900
  })
  
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize
  
  mainWindow = new BrowserWindow({
    'x': mainWindowState.x,
    'y': mainWindowState.y,
    'width': mainWindowState.width,
    'height': mainWindowState.height,
    webPreferences: {
      webSecurity: app.isPackaged ? true : false,
      preload: path.join(__dirname, '../preload.js')
    },
    show: false
  })
  
  mainWindowState.manage(mainWindow)
  
  // 窗口事件
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    if (setting?.openDevTools) {
      mainWindow.webContents.openDevTools()
    }
  })
  
  mainWindow.on('close', (event) => {
    if (setting?.minimizeToTray && !app.isQuitting) {
      event.preventDefault()
      mainWindow.hide()
    }
  })
  
  mainWindow.on('closed', () => {
    mainWindow = null
  })
  
  // 加载应用
  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  } else {
    mainWindow.loadURL('http://localhost:5374/')
  }
  
  // 创建托盘（如果启用）
  if (setting?.enableTray) {
    createTray()
  }
  
  return mainWindow
}

/**
 * 设置进度条
 */
function setProgressBar(progress) {
  if (mainWindow) {
    if (progress < 0 || progress > 1) {
      mainWindow.setProgressBar(-1)
    } else {
      mainWindow.setProgressBar(progress)
    }
  }
}

/**
 * 发送消息到渲染进程
 */
function sendMessageToWebContents(message) {
  console.log(message)
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('send-message', message)
  }
}

/**
 * 应用生命周期管理
 */
function setupAppLifecycle() {
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
  
  app.on('before-quit', () => {
    app.isQuitting = true
  })
}

/**
 * 注册窗口相关的IPC处理器
 */
function registerWindowHandlers() {
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
    setProgressBar(progress)
  })
}

module.exports = {
  createWindow,
  createTray,
  setProgressBar,
  sendMessageToWebContents,
  setupAppLifecycle,
  registerWindowHandlers,
  getMainWindow: () => mainWindow
}

