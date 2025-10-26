/**
 * IPC处理器统一注册入口
 * 将所有IPC处理器的注册集中管理
 */

const { registerAllHandlers } = require('./all_handlers')
const { registerMetadataHandlers } = require('./metadata_handlers')
const { registerBlacklistHandlers } = require('./blacklist_handlers')
const { registerFolderBatchHandlers } = require('./folder_batch_handlers')
const { registerAiTagHandlers } = require('./ai_tag_handlers')

/**
 * 注册所有IPC处理器
 * @param {Object} dependencies - 所有需要的依赖项
 */
function registerAllIpcHandlers(dependencies) {
  console.log('📝 开始注册所有IPC处理器...')
  
  try {
    // 注册通用处理器
    registerAllHandlers(dependencies)
    
    // 注册元数据处理器
    registerMetadataHandlers(dependencies)
    
    // 注册黑名单处理器
    registerBlacklistHandlers(dependencies)
    
    // 注册文件夹批量操作处理器
    registerFolderBatchHandlers(dependencies)
    
    // 注册 AI 标签处理器
    registerAiTagHandlers(dependencies)
    
    console.log('✅ 所有IPC处理器注册完成')
    return true
  } catch (error) {
    console.error('❌ IPC处理器注册失败:', error)
    return false
  }
}

module.exports = {
  registerAllIpcHandlers
}

