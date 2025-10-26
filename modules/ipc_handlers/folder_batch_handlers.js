/**
 * 文件夹批量操作处理器
 * 处理文件夹树的批量标签修改功能
 */

const { ipcMain } = require('electron')

/**
 * 注册文件夹批量操作相关的IPC处理器
 * @param {Object} dependencies - 依赖项
 */
function registerFolderBatchHandlers(dependencies) {
  const { db } = dependencies
  
  console.log('📝 注册文件夹批量操作处理器...')
  
  // 批量更新画师/社团标签
  ipcMain.handle('batch-update-artist-group-tags', async (event, folders) => {
    try {
      console.log(`📝 开始批量更新画师/社团标签，文件夹数量: ${folders.length}`)
      
      const result = await batchUpdateTags(db, folders, ['artist', 'group'])
      
      console.log(`✅ 批量更新画师/社团标签完成，更新了 ${result.updatedCount} 个文件`)
      return result
    } catch (error) {
      console.error('❌ 批量更新画师/社团标签失败:', error)
      return {
        success: false,
        message: error.message,
        updatedCount: 0
      }
    }
  })
  
  // 批量更新Coser标签
  ipcMain.handle('batch-update-coser-tags', async (event, folders) => {
    try {
      console.log(`📝 开始批量更新Coser标签，文件夹数量: ${folders.length}`)
      
      const result = await batchUpdateTags(db, folders, ['cosplayer'])
      
      console.log(`✅ 批量更新Coser标签完成，更新了 ${result.updatedCount} 个文件`)
      return result
    } catch (error) {
      console.error('❌ 批量更新Coser标签失败:', error)
      return {
        success: false,
        message: error.message,
        updatedCount: 0
      }
    }
  })
  
  console.log('✅ 文件夹批量操作处理器注册完成')
}

/**
 * 批量更新标签
 * @param {Object} db - 数据库实例
 * @param {Array} folders - 文件夹路径数组
 * @param {Array} categories - 要更新的标签类别
 * @returns {Object} 更新结果
 */
async function batchUpdateTags(db, folders, categories) {
  let updatedCount = 0
  const errors = []
  
  for (const folderPath of folders) {
    try {
      // 规范化文件夹路径
      const normalizedPath = normalizePath(folderPath)
      
      // 获取该文件夹下的所有书籍
      const books = await getBooksInFolder(db, normalizedPath)
      
      if (books.length === 0) {
        console.log(`⚠️ 文件夹 ${folderPath} 下没有找到书籍`)
        continue
      }
      
      console.log(`📚 文件夹 ${folderPath} 下找到 ${books.length} 本书`)
      
      // 对每个类别分别处理
      for (const category of categories) {
        // 统计该文件夹下所有书籍中该类别标签的出现次数
        const tagCounts = countTagsByCategory(books, category)
        
        if (Object.keys(tagCounts).length === 0) {
          console.log(`⚠️ 文件夹 ${folderPath} 下没有找到 ${category} 标签`)
          continue
        }
        
        // 找出出现次数最多的标签
        const mostCommonTag = getMostCommonTag(tagCounts)
        console.log(`🏆 文件夹 ${folderPath} 中 ${category} 类别最常见的标签: ${mostCommonTag} (出现 ${tagCounts[mostCommonTag]} 次)`)
        
        // 更新该文件夹下所有书籍的该类别标签
        // 只更新没有该类别标签的书籍
        for (const book of books) {
          const bookTags = book.tags[category] || []
          
          // 跳过已经有该类别标签的书籍
          if (bookTags.length > 0) {
            console.log(`⏭️ 跳过书籍 ${book.id}，已有 ${category} 标签: ${bookTags.join(', ')}`)
            continue
          }
          
          const updated = await updateBookTag(db, book.id, category, mostCommonTag)
          if (updated) {
            updatedCount++
            console.log(`✅ 更新书籍 ${book.id} 的 ${category} 标签为: ${mostCommonTag}`)
          }
        }
      }
    } catch (error) {
      console.error(`❌ 处理文件夹 ${folderPath} 时出错:`, error)
      errors.push({ folder: folderPath, error: error.message })
    }
  }
  
  return {
    success: true,
    updatedCount,
    errors: errors.length > 0 ? errors : undefined
  }
}

/**
 * 规范化路径（统一使用正斜杠，小写化Windows盘符）
 */
function normalizePath(p) {
  let s = String(p || '').replace(/[\\/]+/g, '/')
  if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1)
  if (/^[A-Za-z]:/.test(s)) s = s.toLowerCase()
  return s
}

/**
 * 获取文件夹下的所有书籍
 * 只返回 non-tag 或 tag-failed 状态的书籍
 */
async function getBooksInFolder(db, folderPath) {
  try {
    // 使用Sequelize查询
    // 查询filepath以folderPath开头的所有书籍
    const pattern = folderPath + '/%'
    
    const books = await db.findAll({
      where: {
        filepath: {
          [db.sequelize.Sequelize.Op.like]: pattern
        },
        // 只查询 non-tag 或 tag-failed 状态的书籍
        status: {
          [db.sequelize.Sequelize.Op.in]: ['non-tag', 'tag-failed']
        }
      },
      attributes: ['id', 'filepath', 'tags', 'status'],
      raw: true
    })
    
    // tags字段已经是JSON格式，Sequelize会自动解析
    return books.map(book => ({
      ...book,
      tags: typeof book.tags === 'string' ? JSON.parse(book.tags) : (book.tags || {})
    }))
  } catch (error) {
    console.error('查询文件夹书籍失败:', error)
    throw error
  }
}

/**
 * 统计某个类别的标签出现次数
 */
function countTagsByCategory(books, category) {
  const tagCounts = {}
  
  for (const book of books) {
    const tags = book.tags[category] || []
    for (const tag of tags) {
      if (tag && tag.trim()) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1
      }
    }
  }
  
  return tagCounts
}

/**
 * 获取出现次数最多的标签
 */
function getMostCommonTag(tagCounts) {
  let maxCount = 0
  let mostCommonTag = null
  
  for (const [tag, count] of Object.entries(tagCounts)) {
    if (count > maxCount) {
      maxCount = count
      mostCommonTag = tag
    }
  }
  
  return mostCommonTag
}

/**
 * 更新书籍的某个类别标签
 */
async function updateBookTag(db, bookId, category, newTag) {
  try {
    // 首先获取当前的书籍
    const book = await db.findByPk(bookId)
    
    if (!book) {
      return false
    }
    
    // 获取当前的tags
    let tags = book.tags || {}
    if (typeof tags === 'string') {
      tags = JSON.parse(tags)
    }
    
    // 更新指定类别的标签（替换为新标签）
    tags[category] = [newTag]
    
    // 保存回数据库
    await book.update({ tags })
    
    return true
  } catch (error) {
    console.error(`更新书籍 ${bookId} 的标签失败:`, error)
    throw error
  }
}

module.exports = {
  registerFolderBatchHandlers
}

