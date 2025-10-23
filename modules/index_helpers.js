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
 * 这个函数封装了 geneCoverFromBuffer，提供一致的接口
 */
async function coverAndHashInMem(filepath, type, options = {}) {
  const { signal } = options
  
  try {
    // 直接使用 geneCoverFromBuffer
    const { geneCoverFromBuffer } = require('../fileLoader/index.js')
    const result = await geneCoverFromBuffer(filepath, type, { signal })
    
    // geneCoverFromBuffer 返回: { hash, coverPath, pageCount, bundleSize, mtime, coverHash, coverSharp }
    // coverSharp 是一个 sharp 实例，我们需要转换成 Buffer
    let coverSharpBuffer
    if (result.coverSharp) {
      if (Buffer.isBuffer(result.coverSharp)) {
        coverSharpBuffer = result.coverSharp
      } else if (typeof result.coverSharp.toBuffer === 'function') {
        coverSharpBuffer = await result.coverSharp.toBuffer()
      } else {
        // coverSharp 已经是 sharp 实例，保持原样
        coverSharpBuffer = result.coverSharp
      }
    }
    
    return {
      ...result,
      coverSharp: coverSharpBuffer
    }
  } catch (error) {
    console.error(`Error in coverAndHashInMem for ${filepath}:`, error.message)
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
  
  // 如果没有传入libraries，使用setting.libraries
  const libPaths = libraries 
    ? (Array.isArray(libraries) ? libraries : [libraries])
    : (setting.libraries || [])
  
  // 如果没有传入excludePatterns，尝试使用setting.excludeFile
  let excludeList = excludePatterns
  if (excludePatterns.length === 0 && setting.excludeFile) {
    // setting.excludeFile 可能是glob模式字符串或正则表达式字符串
    // 这里我们将其作为glob模式使用
    excludeList = [setting.excludeFile]
  }
  
  console.log('[scanLibraryFilesWithExclude] 📁 扫描路径:', libPaths)
  console.log('[scanLibraryFilesWithExclude] ⚙️ allowFolderAsManga:', setting.allowFolderAsManga)
  if (excludeList.length > 0) {
    console.log('[scanLibraryFilesWithExclude] 🚫 排除规则:', excludeList)
  }
  
  const allFiles = []
  
  for (const libPath of libPaths) {
    if (!libPath) {
      console.log('[scanLibraryFilesWithExclude] ⚠️ 跳过空路径')
      continue
    }
    if (!fs.existsSync(libPath)) {
      console.log('[scanLibraryFilesWithExclude] ⚠️ 路径不存在:', libPath)
      continue
    }
    
    console.log('[scanLibraryFilesWithExclude] 🔍 正在扫描:', libPath)
    
    // 扫描压缩文件
    const archives = await glob.glob('**/*.{zip,7z,rar,cbz,cb7,cbr}', {
      cwd: libPath,
      absolute: true,
      nodir: true,
      ignore: excludeList
    })
    
    console.log(`[scanLibraryFilesWithExclude] 📦 找到 ${archives.length} 个压缩文件`)
    
    // 扫描文件夹 (如果允许)
    if (setting.allowFolderAsManga) {
      const folders = await glob.glob('**/', {
        cwd: libPath,
        absolute: true,
        ignore: excludeList
      })
      
      console.log(`[scanLibraryFilesWithExclude] 📁 找到 ${folders.length} 个文件夹`)
      
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
  
  console.log(`[scanLibraryFilesWithExclude] ✅ 总共找到 ${allFiles.length} 个文件`)
  
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

