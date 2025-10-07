/**
 * Translation Database Module
 * 翻译数据库模块 - 使用SQLite存储翻译数据
 */

const { Sequelize, DataTypes } = require('sequelize')
const path = require('path')
const { STORE_PATH } = require('./init_folder_setting.js')

// 翻译数据库路径
const TRANSLATION_DB_PATH = path.join(STORE_PATH, 'translations.db')

let sequelize = null
let Translation = null

/**
 * Initialize translation database
 * 初始化翻译数据库
 */
function initTranslationDatabase() {
  if (sequelize) {
    return { sequelize, Translation }
  }

  console.log('[Translation DB] Initializing database at:', TRANSLATION_DB_PATH)

  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: TRANSLATION_DB_PATH,
    logging: false, // 生产环境关闭日志，需要调试时可以改为 console.log
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    retry: {
      max: 3
    },
    dialectOptions: {
      // SQLite specific options
      busyTimeout: 30000, // 30 seconds timeout for locked database
      journalMode: 'WAL'  // Write-Ahead Logging for better concurrency
    }
  })

  // 定义翻译表结构
  Translation = sequelize.define('Translation', {
    hash: {
      type: DataTypes.TEXT,
      allowNull: false,
      primaryKey: true,
      comment: '书籍哈希值（唯一标识）'
    },
    chinese_title: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'AI翻译的中文标题'
    },
    original_english: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '原始英文标题'
    },
    original_japanese: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '原始日文标题'
    },
    filename: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '文件名'
    },
    fallback: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: '是否使用了后备方案'
    },
    last_updated: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      comment: '最后更新时间'
    }
  }, {
    tableName: 'translations',
    freezeTableName: true,
    timestamps: false, // 使用自定义的 last_updated 字段
    indexes: [
      {
        name: 'idx_hash',
        unique: true,
        fields: ['hash']
      },
      {
        name: 'idx_last_updated',
        fields: ['last_updated']
      }
    ]
  })

  return { sequelize, Translation }
}

/**
 * Ensure database is initialized and synced
 * 确保数据库已初始化并同步
 */
async function ensureDatabase() {
  const { sequelize, Translation } = initTranslationDatabase()
  try {
    // 使用 alter: false 避免重复创建索引
    await sequelize.sync({ alter: false })
  } catch (e) {
    // 忽略索引已存在的错误
    if (!e.message.includes('already exists')) {
      console.error('[Translation DB] Sync error:', e)
    }
  }
  return { sequelize, Translation }
}

/**
 * Get translation for a book by hash
 * 根据哈希获取书籍翻译
 */
async function getTranslation(bookHash) {
  try {
    const { Translation } = await ensureDatabase()
    const translation = await Translation.findByPk(bookHash)
    
    if (translation) {
      return translation.toJSON()
    }
    return null
  } catch (e) {
    console.error('[Translation DB] Failed to get translation:', e)
    return null
  }
}

/**
 * Save or update translation for a book
 * 保存或更新书籍翻译
 */
async function saveTranslation(bookHash, translationData) {
  try {
    const { Translation } = await ensureDatabase()
    
    const data = {
      hash: bookHash,
      chinese_title: translationData.chinese_title,
      original_english: translationData.original_english || null,
      original_japanese: translationData.original_japanese || null,
      filename: translationData.filename || null,
      fallback: translationData.fallback || false,
      last_updated: new Date()
    }

    await Translation.upsert(data)
    console.log(`[Translation DB] Saved translation for: ${bookHash}`)
    return true
  } catch (e) {
    console.error('[Translation DB] Failed to save translation:', e)
    throw e
  }
}

/**
 * Check if translation exists for a book
 * 检查书籍是否已有翻译
 */
async function hasTranslation(bookHash) {
  try {
    const { Translation } = await ensureDatabase()
    const count = await Translation.count({ where: { hash: bookHash } })
    return count > 0
  } catch (e) {
    console.error('[Translation DB] Failed to check translation:', e)
    return false
  }
}

/**
 * Get all translations (for migration or export)
 * 获取所有翻译（用于迁移或导出）
 */
async function getAllTranslations() {
  try {
    const { Translation } = await ensureDatabase()
    const translations = await Translation.findAll()
    return translations.map(t => t.toJSON())
  } catch (e) {
    console.error('[Translation DB] Failed to get all translations:', e)
    return []
  }
}

/**
 * Batch get translations for multiple books
 * 批量获取多个书籍的翻译
 */
async function getTranslationsBatch(bookHashes) {
  try {
    const { Translation } = await ensureDatabase()
    const translations = await Translation.findAll({
      where: {
        hash: bookHashes
      }
    })
    
    // 转换为 Map 格式方便查找
    const translationMap = {}
    translations.forEach(t => {
      const data = t.toJSON()
      translationMap[data.hash] = data
    })
    
    return translationMap
  } catch (e) {
    console.error('[Translation DB] Failed to get translations batch:', e)
    return {}
  }
}

/**
 * Delete translation for a book
 * 删除书籍翻译
 */
async function deleteTranslation(bookHash) {
  try {
    const { Translation } = await ensureDatabase()
    await Translation.destroy({ where: { hash: bookHash } })
    console.log(`[Translation DB] Deleted translation for: ${bookHash}`)
    return true
  } catch (e) {
    console.error('[Translation DB] Failed to delete translation:', e)
    return false
  }
}

/**
 * Get translation statistics
 * 获取翻译统计信息
 */
async function getTranslationStats() {
  try {
    const { Translation } = await ensureDatabase()
    const total = await Translation.count()
    const withFallback = await Translation.count({ where: { fallback: true } })
    
    return {
      total,
      successful: total - withFallback,
      fallback: withFallback
    }
  } catch (e) {
    console.error('[Translation DB] Failed to get stats:', e)
    return { total: 0, successful: 0, fallback: 0 }
  }
}

/**
 * Migrate translations from JSON file to database
 * 从JSON文件迁移翻译到数据库
 */
async function migrateFromJSON(jsonFilePath) {
  try {
    const fs = require('fs')
    
    if (!fs.existsSync(jsonFilePath)) {
      console.log('[Translation DB] No JSON file to migrate')
      return { success: 0, failed: 0 }
    }

    const data = fs.readFileSync(jsonFilePath, 'utf8')
    const translations = JSON.parse(data)
    
    console.log(`[Translation DB] Migrating ${Object.keys(translations).length} translations from JSON...`)
    
    let success = 0
    let failed = 0
    
    for (const [hash, translation] of Object.entries(translations)) {
      try {
        await saveTranslation(hash, translation)
        success++
      } catch (e) {
        console.error(`[Translation DB] Failed to migrate translation for ${hash}:`, e)
        failed++
      }
    }
    
    console.log(`[Translation DB] Migration complete: ${success} success, ${failed} failed`)
    
    // 备份原JSON文件
    const backupPath = jsonFilePath + '.backup'
    fs.renameSync(jsonFilePath, backupPath)
    console.log(`[Translation DB] Original JSON backed up to: ${backupPath}`)
    
    return { success, failed }
  } catch (e) {
    console.error('[Translation DB] Migration failed:', e)
    throw e
  }
}

/**
 * Export translations to JSON file (for backup)
 * 导出翻译到JSON文件（用于备份）
 */
async function exportToJSON(jsonFilePath) {
  try {
    const fs = require('fs')
    const translations = await getAllTranslations()
    
    // 转换为旧格式
    const jsonData = {}
    translations.forEach(t => {
      jsonData[t.hash] = {
        chinese_title: t.chinese_title,
        original_english: t.original_english,
        original_japanese: t.original_japanese,
        filename: t.filename,
        fallback: t.fallback,
        last_updated: t.last_updated
      }
    })
    
    fs.writeFileSync(jsonFilePath, JSON.stringify(jsonData, null, 2), 'utf8')
    console.log(`[Translation DB] Exported ${translations.length} translations to: ${jsonFilePath}`)
    return true
  } catch (e) {
    console.error('[Translation DB] Export failed:', e)
    throw e
  }
}

module.exports = {
  initTranslationDatabase,
  ensureDatabase,
  getTranslation,
  saveTranslation,
  hasTranslation,
  getAllTranslations,
  getTranslationsBatch,
  deleteTranslation,
  getTranslationStats,
  migrateFromJSON,
  exportToJSON,
  TRANSLATION_DB_PATH
}
