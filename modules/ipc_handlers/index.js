/**
 * IPC处理器统一注册入口
 * @CUSTOM: 自定义IPC处理器集合
 */

const { registerMetadataHandlers } = require('./metadata_handlers')
const { registerBlacklistHandlers } = require('./blacklist_handlers')

/**
 * 注册所有自定义IPC处理器
 * @param {Object} dependencies - 依赖对象
 * @param {BrowserWindow} dependencies.mainWindow - 主窗口
 * @param {Model} dependencies.Manga - Manga模型
 * @param {Model} dependencies.Metadata - Metadata模型
 * @param {Object} dependencies.setting - 设置对象
 * @param {Function} dependencies.sendMessageToWebContents - 发送消息函数
 */
function registerAllCustomHandlers(dependencies) {
  console.log('📝 注册自定义IPC处理器...')
  
  // 注册元数据处理器
  registerMetadataHandlers(dependencies)
  console.log('  ✅ 元数据处理器已注册')
  
  // 注册黑名单处理器
  registerBlacklistHandlers(dependencies)
  console.log('  ✅ 黑名单处理器已注册')
  
  console.log('✅ 所有自定义IPC处理器注册完成')
}

module.exports = {
  registerAllCustomHandlers,
  registerMetadataHandlers,
  registerBlacklistHandlers
}

