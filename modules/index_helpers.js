/**
 * Index.js 辅助函数集合
 * 提取出来以减少主文件行数
 */

const { app } = require('electron')
const fs = require('fs')
const path = require('path')
const { exec } = require('child_process')
const sharp = require('sharp')
const { createHash } = require('crypto')
const { geneCoverFromBuffer } = require('../fileLoader/index.js')
const { makeShardedPath } = require('../fileLoader/folder.js')

let context = null // 全局上下文，用于中断控制

/**
 * 创建可中断的上下文
 */
function createAbortableContext(event) {
  // Abort prior scan if any
  if (context?.controller && !context.controller.signal.aborted) {
    context.controller.abort()
  }

  const controller = new AbortController()
  const children = new Set()     // track spawned child processes
  const tempDirs = new Set()     // track temp dirs you create
  const onAbort = () => {
    // Kill children on abort
    for (const cp of children) {
      // Try a graceful kill first, then force if needed
      if (!cp.killed) cp.kill('SIGTERM')
      // In case SIGTERM isn't supported or process ignores it:
      setTimeout(() => { try { if (!cp.killed) cp.kill('SIGKILL') } catch {} }, 5000)
    }
  }
  controller.signal.addEventListener('abort', onAbort, { once: true })

  // Abort if the window/renderer goes away
  const sender = event?.sender
  if (sender) {
    const abortOnDestroyed = () => controller.abort()
    sender.once('destroyed', abortOnDestroyed)
    // Ensure we remove the listener on cleanup if not destroyed
    controller.signal.addEventListener('abort', () => {
      try { sender.removeListener?.('destroyed', abortOnDestroyed) } catch {}
    }, { once: true })
  }

  // Abort on app quit
  const abortOnQuit = () => controller.abort()
  app.once('before-quit', abortOnQuit)
  controller.signal.addEventListener('abort', () => {
    try { app.removeListener('before-quit', abortOnQuit) } catch {}
  }, { once: true })

  context = { controller, children, tempDirs }
  return context
}

/**
 * 创建并发限制器
 */
function createLimiter(concurrency) {
  let running = 0
  const queue = []

  return async function limit(fn) {
    while (running >= concurrency) {
      await new Promise(resolve => queue.push(resolve))
    }
    running++
    try {
      return await fn()
    } finally {
      running--
      const next = queue.shift()
      if (next) next()
    }
  }
}

/**
 * 检查路径是否存在
 */
async function pathExists(p) {
  try {
    await fs.promises.stat(p)
    return true
  } catch (e) {
    return !(e && (e.code === 'ENOENT' || e.code === 'ENOTDIR'))
  }
}

/**
 * 在文件夹中查找压缩包
 */
function findArchiveInFolder(filepath) {
  try {
    if (!fs.existsSync(filepath)) return null
    const stats = fs.statSync(filepath)
    if (!stats.isDirectory()) return null
    
    const files = fs.readdirSync(filepath)
    const archiveExts = ['.zip', '.7z', '.rar', '.cbz', '.cb7', '.cbr']
    
    for (const file of files) {
      const ext = path.extname(file).toLowerCase()
      if (archiveExts.includes(ext)) {
        return path.join(filepath, file)
      }
    }
    return null
  } catch (e) {
    return null
  }
}

/**
 * 手动获取EhViewer数据
 */
function getEhviewerDataManually(dir) {
  try {
    const infoPath = path.join(dir, '.ehviewer')
    if (!fs.existsSync(infoPath)) return null
    
    const content = fs.readFileSync(infoPath, 'utf8')
    const lines = content.split('\n')
    
    let gid, token
    for (const line of lines) {
      if (line.startsWith('gid=')) {
        gid = line.substring(4).trim()
      } else if (line.startsWith('token=')) {
        token = line.substring(6).trim()
      }
    }
    
    return gid && token ? { gid, token } : null
  } catch (e) {
    return null
  }
}

/**
 * 在内存中生成封面和哈希
 */
async function coverAndHashInMem(filepath, type, options = {}) {
  const { signal, COVER_PATH } = options
  
  try {
    // 获取文件列表
    const { getBookFilelist } = require('../fileLoader/index.js')
    const fileList = await getBookFilelist(filepath, type, { signal })
    
    if (!fileList || fileList.length === 0) {
      throw new Error('No files found in archive')
    }
    
    // 获取第一个图片作为封面
    const firstImage = fileList[0]
    const imageBuffer = firstImage.buffer || firstImage.data
    
    if (!imageBuffer) {
      throw new Error('No image buffer available')
    }
    
    // 生成封面哈希
    const coverHash = createHash('sha256').update(imageBuffer).digest('hex')
    const coverPath = makeShardedPath(COVER_PATH, `${coverHash}.webp`)
    
    // 生成封面缩略图
    const coverSharp = sharp(imageBuffer)
      .resize(200, 283, { fit: 'cover' })
      .webp({ quality: 80 })
    
    const coverBuffer = await coverSharp.toBuffer()
    
    // 计算文件哈希
    const hash = createHash('sha256')
    for (const file of fileList) {
      const buf = file.buffer || file.data
      if (buf) hash.update(buf)
    }
    const fileHash = hash.digest('hex')
    
    // 获取文件信息
    const stats = fs.statSync(filepath)
    
    return {
      coverPath,
      coverHash,
      hash: fileHash,
      pageCount: fileList.length,
      bundleSize: stats.size,
      mtime: stats.mtimeMs,
      coverSharp: coverBuffer
    }
  } catch (error) {
    throw error
  }
}

/**
 * 比较项目（用于排序）
 */
function compareItems(a, b, sortKey, ascending = false) {
  let aVal = a[sortKey]
  let bVal = b[sortKey]
  
  // Handle undefined/null
  if (aVal == null && bVal == null) return 0
  if (aVal == null) return ascending ? -1 : 1
  if (bVal == null) return ascending ? 1 : -1
  
  // Numeric comparison
  if (typeof aVal === 'number' && typeof bVal === 'number') {
    return ascending ? aVal - bVal : bVal - aVal
  }
  
  // String comparison
  aVal = String(aVal).toLowerCase()
  bVal = String(bVal).toLowerCase()
  
  if (aVal < bVal) return ascending ? -1 : 1
  if (aVal > bVal) return ascending ? 1 : -1
  return 0
}

/**
 * 格式化标签
 */
const formatTags = (tags) => {
  if (!tags || typeof tags !== 'object') return ''
  
  const tagArray = []
  for (const [category, values] of Object.entries(tags)) {
    if (Array.isArray(values) && values.length > 0) {
      tagArray.push(...values.map(v => `${category}:${v}`))
    }
  }
  return tagArray.join(', ')
}

/**
 * 扫描库文件（带排除）
 */
async function scanLibraryFilesWithExclude(libraries, excludePatterns = []) {
  const glob = require('glob')
  const { prepareSetting } = require('./init_folder_setting')
  const setting = prepareSetting()
  
  // 如果没有传入libraries，使用setting.rootFolders
  const libPaths = libraries 
    ? (Array.isArray(libraries) ? libraries : [libraries])
    : (setting.rootFolders || [])
  
  const allFiles = []
  
  for (const libPath of libPaths) {
    if (!libPath || !fs.existsSync(libPath)) continue
    
    // 扫描压缩文件
    const archives = await glob.glob('**/*.{zip,7z,rar,cbz,cb7,cbr}', {
      cwd: libPath,
      absolute: true,
      nodir: true,
      ignore: excludePatterns
    })
    
    // 扫描文件夹 (如果允许)
    if (setting.allowFolderAsManga) {
      const folders = await glob.glob('**/', {
        cwd: libPath,
        absolute: true,
        ignore: excludePatterns
      })
      
      allFiles.push(
        ...archives.map(f => ({ filepath: f, type: 'archive' })),
        ...folders.map(f => ({ filepath: f, type: 'folder' }))
      )
    } else {
      allFiles.push(
        ...archives.map(f => ({ filepath: f, type: 'archive' }))
      )
    }
  }
  
  return allFiles
}

module.exports = {
  createAbortableContext,
  createLimiter,
  pathExists,
  findArchiveInFolder,
  getEhviewerDataManually,
  coverAndHashInMem,
  compareItems,
  formatTags,
  scanLibraryFilesWithExclude
}

