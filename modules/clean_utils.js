/**
 * 清理工具模块
 * 提供数据库清理相关功能
 */

/**
 * 清理所有文件夹类型的漫画记录
 * @param {Object} Manga - Sequelize Manga 模型
 * @param {Function} sendMessageToWebContents - 发送消息到前端的函数
 * @returns {Promise<{success: boolean, count: number, error?: string}>}
 */
async function cleanFolderManga(Manga, sendMessageToWebContents) {
  try {
    sendMessageToWebContents('开始清理文件夹类型漫画...')
    
    // 查询所有 type='folder' 的漫画
    const folderBooks = await Manga.findAll({ 
      where: { type: 'folder' },
      raw: true 
    })
    const count = folderBooks.length
    
    if (count === 0) {
      sendMessageToWebContents('✅ 没有找到文件夹类型漫画')
      return { success: true, count: 0 }
    }
    
    // 批量删除
    await Manga.destroy({ where: { type: 'folder' } })
    sendMessageToWebContents(`✅ 已清理 ${count} 个文件夹类型漫画`)
    
    return { success: true, count }
  } catch (e) {
    sendMessageToWebContents(`❌ 清理失败: ${e.message}`)
    return { success: false, count: 0, error: e.message }
  }
}

module.exports = {
  cleanFolderManga
}
