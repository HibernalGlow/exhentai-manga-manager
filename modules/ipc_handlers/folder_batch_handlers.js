/**
 * 文件夹批量操作处理器
 * 处理文件夹树的批量标签修改功能
 */

const { ipcMain } = require('electron')

/**
 * 注册文件夹批量操作相关的IPC处理器
 * @param {Object} dependencies - 依赖项
 */
// 开发模式标志
const DEBUG = process.env.NODE_ENV === 'development'

function registerFolderBatchHandlers(dependencies) {
  const { db } = dependencies
  
  console.log('📝 注册文件夹批量操作处理器...')
  
  // 预览批量更新标签
  ipcMain.handle('preview-batch-update-tags', async (event, { folders, categories }) => {
    try {
      console.log(`📝 预览批量更新标签，文件夹数量: ${folders.length}，类别: ${categories.join(', ')}`)
      
      const preview = []
      
      for (const folderPath of folders) {
        try {
          const normalizedPath = normalizePath(folderPath)
          const books = await getBooksInFolder(db, normalizedPath)
          
          const folderInfo = {
            folder: folderPath,
            willUpdateCount: 0
          }
          
          // 统计每个类别的标签
          for (const category of categories) {
            const tagCounts = countTagsByCategory(books, category)
            
            if (Object.keys(tagCounts).length > 0) {
              const mostCommonTag = getMostCommonTag(tagCounts)
              const count = tagCounts[mostCommonTag]
              
              folderInfo[category] = mostCommonTag
              folderInfo[`${category}Count`] = count
              
              // 统计将要更新的书籍数量
              for (const book of books) {
                const bookTags = book.tags[category] || []
                if (bookTags.length === 0) {
                  folderInfo.willUpdateCount++
                }
              }
            }
          }
          
          preview.push(folderInfo)
        } catch (error) {
          console.error(`预览文件夹 ${folderPath} 失败:`, error)
        }
      }
      
      return {
        success: true,
        preview
      }
    } catch (error) {
      console.error('预览批量更新标签失败:', error)
      return {
        success: false,
        message: error.message
      }
    }
  })
  
  // 批量更新画师/社团标签
  ipcMain.handle('batch-update-artist-group-tags', async (event, folders) => {
    try {
      console.log(`📝 开始批量更新画师/社团标签，文件夹数量: ${folders.length}`)
      console.log(`📁 接收到的文件夹路径:`)
      folders.slice(0, 3).forEach((folder, idx) => {
        console.log(`   ${idx + 1}. ${folder}`)
      })
      
      // 调试：显示数据库中的实际路径格式
      const totalCount = await db.count()
      console.log(`📊 数据库总书籍数: ${totalCount}`)
      
      const sampleBooks = await db.findAll({
        attributes: ['filepath', 'status'],
        limit: 10,
        raw: true
      })
      console.log(`📚 数据库中的示例路径（前10本书）:`)
      sampleBooks.forEach((book, idx) => {
        console.log(`   ${idx + 1}. ${book.filepath} [${book.status}]`)
      })
      
      // 测试路径格式
      if (folders.length > 0) {
        const testFolder = folders[0]
        console.log(`🔍 测试不同路径格式:`)
        console.log(`   原始: ${testFolder}`)
        
        // 测试各种格式
        const formats = [
          testFolder,  // e:/1hub/eh/1ehv/[artist]
          testFolder.replace(/\//g, '\\'),  // e:\1hub\eh\1ehv\[artist]
          testFolder.charAt(0).toUpperCase() + testFolder.slice(1),  // E:/1hub/eh/1ehv/[artist]
          testFolder.replace(/\//g, '\\').charAt(0).toUpperCase() + testFolder.replace(/\//g, '\\').slice(1),  // E:\1hub\eh\1ehv\[artist]
          'E:\\1Hub\\EH\\1EHV\\' + testFolder.split('/').pop()  // E:\1Hub\EH\1EHV\[artist]
        ]
        
        for (let i = 0; i < formats.length; i++) {
          const count = await db.count({
            where: {
              filepath: {
                [db.sequelize.Sequelize.Op.like]: formats[i] + '%'
              }
            }
          })
          console.log(`   格式${i + 1}: ${formats[i]} -> ${count} 本`)
        }
      }
      
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
      const { allBooks, booksToUpdate } = await getBooksInFolder(db, normalizedPath)
      
      if (allBooks.length === 0) {
        console.log(`⚠️ 文件夹 ${folderPath} 下没有找到书籍`)
        continue
      }
      
      console.log(`📚 文件夹 ${folderPath} 下找到 ${allBooks.length} 本书，其中 ${booksToUpdate.length} 本需要更新`)
      
      if (booksToUpdate.length === 0) {
        console.log(`ℹ️ 文件夹 ${folderPath} 下没有需要更新的书籍（non-tag/tag-failed）`)
        continue
      }
      
      // 收集本文件夹的所有更新操作
      const folderUpdates = []
      
      // 对每个类别分别处理
      for (const category of categories) {
        // 统计该文件夹下【所有书籍】中该类别标签的出现次数（包括已标记的）
        const tagCounts = countTagsByCategory(allBooks, category)
        
        if (Object.keys(tagCounts).length === 0) {
          console.log(`⚠️ 文件夹 ${folderPath} 下没有找到 ${category} 标签`)
          continue
        }
        
        // 找出出现次数最多的标签
        const mostCommonTag = getMostCommonTag(tagCounts)
        console.log(`🏆 文件夹 ${folderPath} 中 ${category} 类别最常见的标签: ${mostCommonTag} (出现 ${tagCounts[mostCommonTag]} 次)`)
        
        // 收集需要更新的书籍
        for (const book of booksToUpdate) {
          const bookTags = book.tags[category] || []
          
          // 跳过已经有该类别标签的书籍
          if (bookTags.length > 0) {
            continue
          }
          
          folderUpdates.push({
            bookId: book.id,
            category,
            newTag: mostCommonTag
          })
        }
      }
      
      // 批量更新本文件夹的所有书籍
      if (folderUpdates.length > 0) {
        const updated = await batchUpdateBookTags(db, folderUpdates)
        updatedCount += updated
        console.log(`✅ 文件夹 ${folderPath} 更新了 ${updated} 本书`)
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

// 路径规范化缓存
const pathNormalizeCache = new Map()

/**
 * 规范化路径（统一使用反斜杠，匹配数据库格式）
 * 数据库中存储的是 E:\1Hub\EH\1EHV\... 格式
 */
function normalizePath(p) {
  // 检查缓存
  if (pathNormalizeCache.has(p)) {
    return pathNormalizeCache.get(p)
  }
  
  let s = String(p || '').replace(/[\\/]+/g, '\\')
  if (s.length > 1 && s.endsWith('\\')) s = s.slice(0, -1)
  
  // 将盘符转为大写，例如 e: -> E:
  if (/^[a-z]:/.test(s)) {
    s = s.charAt(0).toUpperCase() + s.slice(1)
  }
  
  // 修正路径中的大小写，匹配数据库格式
  // E:\1hub\eh\1ehv\ -> E:\1Hub\EH\1EHV\
  s = s.replace(/^E:\\1hub\\eh\\1ehv\\/i, 'E:\\1Hub\\EH\\1EHV\\')
  
  // 缓存结果（限制缓存大小）
  if (pathNormalizeCache.size > 1000) {
    pathNormalizeCache.clear()
  }
  pathNormalizeCache.set(p, s)
  
  return s
}

/**
 * 获取文件夹下的所有书籍
 * 返回两组：1) 所有书籍（用于统计标签）2) 需要更新的书籍（non-tag/tag-failed）
 */
async function getBooksInFolder(db, folderPath) {
  try {
    const Sequelize = db.sequelize.Sequelize
    
    // 规范化文件夹路径（转换为数据库格式：大写盘符 + 反斜杠）
    const normalizedFolderPath = normalizePath(folderPath)
    
    if (DEBUG) {
      console.log(`🔍 查询文件夹: ${folderPath}`)
      console.log(`   规范化后: ${normalizedFolderPath}`)
    }
    
    // 查询所有书籍（用于统计标签）
    const allBooks = await db.findAll({
      where: {
        filepath: {
          [Sequelize.Op.like]: normalizedFolderPath + '%'
        }
      },
      attributes: ['id', 'filepath', 'tags', 'status'],
      raw: true
    })
    
    // 过滤出真正属于这个文件夹的书籍
    const books = allBooks.filter(book => {
      const normalizedBookPath = normalizePath(book.filepath)
      const prefix = normalizedFolderPath + '\\'
      return normalizedBookPath.toUpperCase().startsWith(prefix.toUpperCase())
    })
    
    // 分离出需要更新的书籍（non-tag 或 tag-failed）
    const booksToUpdate = books.filter(book => 
      book.status === 'non-tag' || book.status === 'tag-failed'
    )
    
    if (DEBUG) {
      console.log(`   查询到 ${allBooks.length} 本，过滤后 ${books.length} 本，需更新 ${booksToUpdate.length} 本`)
    }
    
    // tags字段已经是JSON格式，Sequelize会自动解析
    const parseBook = book => ({
      ...book,
      tags: typeof book.tags === 'string' ? JSON.parse(book.tags) : (book.tags || {})
    })
    
    return {
      allBooks: books.map(parseBook),        // 所有书籍（用于统计）
      booksToUpdate: booksToUpdate.map(parseBook)  // 需要更新的书籍
    }
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
 * 批量更新书籍标签（性能优化）
 */
async function batchUpdateBookTags(db, updates) {
  if (updates.length === 0) return 0
  
  try {
    // 使用事务批量更新
    const result = await db.sequelize.transaction(async (t) => {
      const promises = updates.map(({ bookId, category, newTag }) => {
        return db.sequelize.query(
          `UPDATE Mangas SET tags = json_set(tags, '$.${category}', json_array(?)) WHERE id = ?`,
          {
            replacements: [newTag, bookId],
            type: db.sequelize.Sequelize.QueryTypes.UPDATE,
            transaction: t
          }
        )
      })
      
      await Promise.all(promises)
      return updates.length
    })
    
    return result
  } catch (error) {
    console.error('批量更新标签失败:', error)
    throw error
  }
}

/**
 * 更新单个书籍的某个类别标签（向后兼容）
 */
async function updateBookTag(db, bookId, category, newTag) {
  return batchUpdateBookTags(db, [{ bookId, category, newTag }])
}

module.exports = {
  registerFolderBatchHandlers
}

