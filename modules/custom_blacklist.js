/**
 * 自定义黑名单管理功能
 * 这是本地自定义功能，独立于上游代码
 */

const {
  loadBlacklist,
  saveBlacklist,
  clearBlacklist,
  getBlacklistPath
} = require('./init_folder_setting.js')

/**
 * 检查书籍是否在黑名单中
 * @param {Object} book - 书籍对象
 * @param {Array} blacklist - 黑名单数组
 * @returns {boolean}
 */
function isInBlacklist(book, blacklist) {
  if (!blacklist || !Array.isArray(blacklist)) {
    return false
  }
  return blacklist.some(item => item.id === book.id)
}

/**
 * 添加书籍到黑名单
 * @param {Object} book - 书籍对象
 * @param {Array} blacklist - 黑名单数组
 * @returns {Array} 更新后的黑名单
 */
function addToBlacklist(book, blacklist = []) {
  if (!isInBlacklist(book, blacklist)) {
    blacklist.push({
      id: book.id,
      title: book.title,
      filepath: book.filepath,
      addedAt: new Date().toISOString()
    })
  }
  return blacklist
}

/**
 * 从黑名单中移除书籍
 * @param {string} bookId - 书籍ID
 * @param {Array} blacklist - 黑名单数组
 * @returns {Array} 更新后的黑名单
 */
function removeFromBlacklist(bookId, blacklist = []) {
  return blacklist.filter(item => item.id !== bookId)
}

/**
 * 批量添加到黑名单
 * @param {Array} books - 书籍数组
 * @param {Array} blacklist - 黑名单数组
 * @returns {Array} 更新后的黑名单
 */
function batchAddToBlacklist(books, blacklist = []) {
  books.forEach(book => {
    blacklist = addToBlacklist(book, blacklist)
  })
  return blacklist
}

module.exports = {
  // 基础功能（来自init_folder_setting.js）
  loadBlacklist,
  saveBlacklist,
  clearBlacklist,
  getBlacklistPath,
  
  // 扩展功能
  isInBlacklist,
  addToBlacklist,
  removeFromBlacklist,
  batchAddToBlacklist
}

