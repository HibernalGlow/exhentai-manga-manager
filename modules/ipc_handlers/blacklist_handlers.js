/**
 * 黑名单相关的IPC处理器
 * @CUSTOM: 自定义黑名单管理功能
 */

const { ipcMain } = require('electron')

const {
  loadBlacklist,
  saveBlacklist,
  clearBlacklist,
  getBlacklistPath,
  isInBlacklist,
  addToBlacklist,
  removeFromBlacklist,
  batchAddToBlacklist
} = require('../custom_blacklist')

/**
 * 注册所有黑名单相关的IPC处理器
 */
function registerBlacklistHandlers(dependencies) {
  const { sendMessageToWebContents } = dependencies

  // 加载黑名单
  ipcMain.handle('load-blacklist', async () => {
    try {
      const blacklist = await loadBlacklist()
      return { success: true, blacklist }
    } catch (error) {
      return { success: false, message: error.message }
    }
  })

  // 保存黑名单
  ipcMain.handle('save-blacklist', async (event, blacklist) => {
    try {
      await saveBlacklist(blacklist)
      sendMessageToWebContents(`✅ 黑名单已保存: ${blacklist.length} 项`)
      return { success: true }
    } catch (error) {
      return { success: false, message: error.message }
    }
  })

  // 清空黑名单
  ipcMain.handle('clear-blacklist', async () => {
    try {
      await clearBlacklist()
      sendMessageToWebContents('✅ 黑名单已清空')
      return { success: true }
    } catch (error) {
      return { success: false, message: error.message }
    }
  })

  // 添加到黑名单
  ipcMain.handle('add-to-blacklist', async (event, book) => {
    try {
      let blacklist = await loadBlacklist()
      blacklist = addToBlacklist(book, blacklist)
      await saveBlacklist(blacklist)
      return { success: true, blacklist }
    } catch (error) {
      return { success: false, message: error.message }
    }
  })

  // 从黑名单移除
  ipcMain.handle('remove-from-blacklist', async (event, bookId) => {
    try {
      let blacklist = await loadBlacklist()
      blacklist = removeFromBlacklist(bookId, blacklist)
      await saveBlacklist(blacklist)
      return { success: true, blacklist }
    } catch (error) {
      return { success: false, message: error.message }
    }
  })

  // 批量添加到黑名单
  ipcMain.handle('batch-add-to-blacklist', async (event, books) => {
    try {
      let blacklist = await loadBlacklist()
      blacklist = batchAddToBlacklist(books, blacklist)
      await saveBlacklist(blacklist)
      sendMessageToWebContents(`✅ 已添加 ${books.length} 项到黑名单`)
      return { success: true, blacklist }
    } catch (error) {
      return { success: false, message: error.message }
    }
  })

  // 检查是否在黑名单中
  ipcMain.handle('check-blacklist', async (event, book) => {
    try {
      const blacklist = await loadBlacklist()
      const inBlacklist = isInBlacklist(book, blacklist)
      return { success: true, inBlacklist }
    } catch (error) {
      return { success: false, message: error.message }
    }
  })

  // 获取黑名单路径
  ipcMain.handle('get-blacklist-path', async () => {
    try {
      const blacklistPath = getBlacklistPath()
      return { success: true, path: blacklistPath }
    } catch (error) {
      return { success: false, message: error.message }
    }
  })
}

module.exports = {
  registerBlacklistHandlers
}

