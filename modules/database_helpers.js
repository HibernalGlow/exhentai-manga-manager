/**
 * 数据库辅助函数模块
 * 包含书籍列表的加载、保存和数据库操作相关函数
 */

const path = require('path')
const fs = require('fs')
const fsp = fs.promises
const { promisify } = require('util')
const { brotliDecompress } = require('zlib')
const { performance } = require('node:perf_hooks')
const { QueryTypes } = require('sequelize')
const { createLimiter } = require('./index_helpers')

/**
 * 从压缩文件加载书籍列表
 */
async function loadBookListFromBrFile(STORE_PATH) {
  try {
    const buffer = await fs.promises.readFile(path.join(STORE_PATH, 'bookList.json.br'))
    const decodeBuffer = await promisify(brotliDecompress)(buffer)
    return JSON.parse(decodeBuffer.toString())
  } catch {
    try {
      return JSON.parse(await fs.promises.readFile(path.join(STORE_PATH, 'bookList.json'), { encoding: 'utf-8' }))
    } catch {
      return []
    }
  }
}

/**
 * 从遗留文件加载书籍列表并清理
 */
async function loadLegecyBookListFromFile(STORE_PATH, shell) {
  const bookList = await loadBookListFromBrFile(STORE_PATH)
  try {
    shell.trashItem(path.join(STORE_PATH, 'bookList.json.br'))
    shell.trashItem(path.join(STORE_PATH, 'bookList.json'))
  } catch {
    console.log('Remove Legecy BookList Failed')
  }
  return bookList
}

/**
 * 确保数据库已附加到事务中
 */
async function ensureAttachedTx(sequelize, t, alias, filePath) {
  const rows = await sequelize.query('PRAGMA database_list', {
    type: QueryTypes.SELECT,
    transaction: t,
  })

  const hit = rows.find(r => r.name === alias)

  if (!hit) {
    await sequelize.query(`ATTACH DATABASE $p AS ${alias}`, { bind: { p: filePath }, transaction: t, })
  } else if (path.resolve(hit.file || '') !== path.resolve(filePath)) {
    // Attached to a different file → switch it
    await sequelize.query(`DETACH DATABASE ${alias}`, { transaction: t })
    await sequelize.query(`ATTACH DATABASE $p AS ${alias}`, {
      bind: { p: filePath },
      transaction: t,
    })
  }
}

/**
 * 标记缺失的书籍状态
 */
async function markMissingBooksStatus(bookList) {
  const limit = createLimiter(Math.min(Number(navigator?.hardwareConcurrency || 4), 4))
  const tasks = bookList.map((b) => limit(async () => {
    const p = String(b.filepath || '')
    if (!p) {
      b.category = 'Missing'
      b.exist = false
    }
    try {
      await fsp.access(p)
      b.exist = true
    } catch {
      b.category = 'Missing'
      b.exist = false
    }
  }))
  await Promise.all(tasks)
}

/**
 * 从数据库加载书籍列表
 * 可以传入依赖项对象，或者使用全局变量（向后兼容）
 */
async function loadBookListFromDatabase(dependenciesOrRetryCount = 0, retryCount = 0) {
  // 向后兼容：如果第一个参数是数字，说明是旧的调用方式
  let dependencies
  if (typeof dependenciesOrRetryCount === 'number') {
    retryCount = dependenciesOrRetryCount
    // 使用require获取全局变量（不推荐，但为了兼容性）
    dependencies = null
  } else {
    dependencies = dependenciesOrRetryCount
  }

  // 如果没有传入dependencies，尝试从调用者获取
  const Manga = dependencies?.Manga
  const Metadata = dependencies?.Metadata
  const metadataSqliteFile = dependencies?.metadataSqliteFile
  const STORE_PATH = dependencies?.STORE_PATH
  const shell = dependencies?.shell

  const maxRetries = 3
  const tTotal0 = performance.now()

  try {
    // If DB is empty, seed from legacy source first
    const count = await Manga.count()
    if (count === 0) {
      const legacy = await loadLegecyBookListFromFile(STORE_PATH, shell)
      if (legacy?.length) await saveBookListToDatabase(Manga, legacy)
    }

    const bookList = await Manga.sequelize.transaction(async (t) => {
      // Attach the metadata DB
      await ensureAttachedTx(Manga.sequelize, t, 'meta', metadataSqliteFile)
      
      // Upsert metadata table from the mangas table
      await Manga.sequelize.query(`
        INSERT INTO meta.Metadata (hash, title, status, rating, tags, title_jpn, filecount, posted, filesize,
                                   category, url, mark, createdAt, updatedAt)
        SELECT m.hash,
               m.title,
               m.status,
               m.rating,
               m.tags,
               m.title_jpn,
               m.filecount,
               m.posted,
               m.filesize,
               m.category,
               m.url,
               m.mark,
               m.createdAt,
               m.updatedAt
        FROM main.Mangas AS m
        WHERE NOT EXISTS (SELECT 1 FROM meta.Metadata AS md WHERE md.hash = m.hash)
          AND m.rowid = (SELECT MIN(m2.rowid)
                         FROM main.Mangas m2
                         WHERE m2.hash = m.hash);
      `, { transaction: t })
      
      // Update mangas table from the metadata table
      await Manga.sequelize.query(`
        UPDATE main.Mangas AS m
        SET
          title     = COALESCE(md.title,     m.title),
          rating    = COALESCE(md.rating,    m.rating),
          tags      = COALESCE(md.tags,      m.tags) ,
          title_jpn = COALESCE(md.title_jpn, m.title_jpn),
          filecount = COALESCE(md.filecount, m.filecount),
          posted    = COALESCE(md.posted,    m.posted),
          filesize  = COALESCE(md.filesize,  m.filesize),
          category  = COALESCE(md.category,  m.category),
          url       = COALESCE(md.url,       m.url),
          mark      = COALESCE(md.mark,      m.mark),
          status    = CASE
            WHEN m.status = 'non-tag' AND md.status != 'non-tag' THEN md.status
            ELSE m.status
          END
        FROM meta.Metadata AS md
        WHERE m.hash = md.hash;
      `, { transaction: t })

      return await Manga.findAll({ raw: true, transaction: t })
    })

    console.log(`[DB Helper] Parsing tags for ${bookList.length} books...`);
    for (let i = 0; i < bookList.length; i++) {
      const b = bookList[i];
      // console.log(`[DB Helper] Before parse for book ${b.id}: type=${typeof b.tags}, value=${b.tags}`);
      if (typeof b.tags === 'string') {
        b.tags = JSON.parse(b.tags || '{}');
      } else {
        b.tags = b.tags || {}; // Ensure it's at least an empty object
      }
      // console.log(`[DB Helper] After parse for book ${b.id}: type=${typeof b.tags}`);
    }
    
    // Flag missing books
    await markMissingBooksStatus(bookList)
    return bookList

  } catch (error) {
    console.error(`[Database] Load attempt ${retryCount + 1}/${maxRetries} failed:`, error.message)

    // Check if it's a database lock error and we haven't exceeded max retries
    if ((error.name === 'SequelizeTimeoutError' || error.message.includes('SQLITE_BUSY')) && retryCount < maxRetries - 1) {
      const waitTime = Math.pow(2, retryCount) * 1000 // Exponential backoff
      console.log(`[Database] Database locked, retrying in ${waitTime / 1000}s...`)
      await new Promise(resolve => setTimeout(resolve, waitTime))
      return loadBookListFromDatabase(dependencies, retryCount + 1)
    }

    // If we've exhausted retries or it's a different error, throw it
    throw error
  }
}

/**
 * 保存书籍列表到数据库
 */
async function saveBookListToDatabase(Manga, data) {
  console.log('Empty Exist BookList and Saved New BookList')
  await Manga.destroy({ truncate: true })
  await Manga.bulkCreate(data)
}

/**
 * 保存单本书到数据库
 */
async function saveBookToDatabase(Manga, Metadata, book) {
  await Manga.update(book, { where: { id: book.id } })
  await Metadata.upsert(book)
  console.log(`Saved ${book.title}`)
}

/**
 * 清空文件夹
 */
async function clearFolder(folder) {
  try {
    await fs.promises.rm(folder, { recursive: true, force: true })
    await fs.promises.mkdir(folder, { recursive: true })
  } catch (err) {
    console.log(err)
  }
}

module.exports = {
  loadBookListFromBrFile,
  loadLegecyBookListFromFile,
  ensureAttachedTx,
  markMissingBooksStatus,
  loadBookListFromDatabase,
  saveBookListToDatabase,
  saveBookToDatabase,
  clearFolder
}

