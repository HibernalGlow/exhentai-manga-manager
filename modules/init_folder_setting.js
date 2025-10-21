const fs = require('fs')
const path = require('path')
const { getRootPath } = require('./utils.js')

// 检查是否有模拟的app环境（用于外部脚本）
let STORE_PATH
try {
  const { app } = require('electron')
  STORE_PATH = app.getPath('userData')
} catch {
  // 如果没有electron，使用环境变量或默认路径
  STORE_PATH = process.env.STORE_PATH || path.join(require('os').homedir(), 'AppData', 'Roaming', 'exhentai-manga-manager')
}

if (!fs.existsSync(STORE_PATH)) {
  fs.mkdirSync(STORE_PATH, { recursive: true })
}

const rootPath = getRootPath()
let isPortable = false

console.log('🔍 便携式应用检测:')
console.log('  NODE_ENV:', JSON.stringify(process.env.NODE_ENV))
console.log('  NODE_ENV 类型:', typeof process.env.NODE_ENV)
console.log('  NODE_ENV 长度:', process.env.NODE_ENV ? process.env.NODE_ENV.length : 'undefined')
console.log('  rootPath:', rootPath)
console.log('  app.isPackaged:', require('electron').app.isPackaged)
console.log('  app.getAppPath():', require('electron').app.getAppPath())
console.log('  检查 data 目录:', path.join(rootPath, 'data'))
console.log('  检查 portable 目录:', path.join(rootPath, 'portable'))

// 只有在生产环境中才检测便携式应用，开发环境始终使用用户数据目录
// 加强检查：确保NODE_ENV确实是'development'字符串（去除空格）
const isDevelopment = process.env.NODE_ENV && process.env.NODE_ENV.trim() === 'development'
console.log('  isDevelopment 检查:', isDevelopment)
if (!isDevelopment) {
  console.log('  🔍 执行便携式应用检测')
  try {
    const dataPath = path.join(rootPath, 'data')
    fs.accessSync(dataPath)
    STORE_PATH = dataPath
    isPortable = true
  } catch {
    try {
      fs.accessSync(path.join(rootPath, 'portable'))
      STORE_PATH = rootPath
      isPortable = true
    } catch {
      // 保持当前的 STORE_PATH
    }
  }
}

const TEMP_PATH = path.join(STORE_PATH, 'tmp')
const COVER_PATH = path.join(STORE_PATH, 'cover')
const VIEWER_PATH = path.join(STORE_PATH, 'viewer')

const preparePath = () => {
  fs.mkdirSync(TEMP_PATH, { recursive: true })
  fs.mkdirSync(COVER_PATH, { recursive: true })
  fs.mkdirSync(VIEWER_PATH, { recursive: true })
}

const prepareSetting = () => {
  let setting
  try {
    setting = JSON.parse(fs.readFileSync(path.join(STORE_PATH, 'setting.json'), { encoding: 'utf-8' }))
  } catch (e) {
    setting = {
      proxy: undefined,
      library: [], // app.getPath('downloads')
      metadataPath: undefined,
      imageExplorer: '"C:\Windows\explorer.exe"',
      pageSize: 42,
      loadOnStart: false,
      igneous: '',
      ipb_pass_hash: '',
      ipb_member_id: '',
      star: '',
      showComment: false,
      requireGap: 3000,
      thumbnailColumn: 10,
      showTranslation: false,
      theme: 'dark', //'light e-hentai',
      widthLimit: undefined,
      directEnter: 'detail',
      language: 'default',
      folderTreeWidth: '',
      advancedSearch: true,
      autoCheckUpdates: false,
      customOptions: '',
      defaultExpandTree: true,
      hidePageNumber: false,
      skipDeleteConfirm: false,
      displayTitle: 'japaneseTitle',
      keepReadingProgress: true,
      concurrentScan: 4,
      concurrentWrite: 2,
      allowFolderAsManga: false // 新增，默认关闭
    }
    fs.writeFileSync(path.join(STORE_PATH, 'setting.json'), JSON.stringify(setting, null, '  '), { encoding: 'utf-8' })
  }
  return setting
}

const prepareCollectionList = () => {
  let collectionList
  try {
    collectionList = JSON.parse(fs.readFileSync(path.join(STORE_PATH, 'collectionList.json'), { encoding: 'utf-8' }))
  } catch {
    collectionList = []
    fs.writeFileSync(path.join(STORE_PATH, 'collectionList.json'), JSON.stringify(collectionList, null, '  '), { encoding: 'utf-8' })
  }
  return collectionList
}

// 黑名单管理函数（始终使用 STORE_PATH，与 zip_blacklist.json 保持一致）
const getBlacklistPath = () => {
  return path.join(STORE_PATH, 'match-blacklist.json')
}

const loadBlacklist = () => {
  try {
    const blacklistPath = getBlacklistPath()
    console.log(`[黑名单加载] STORE_PATH: ${STORE_PATH}`)
    console.log(`[黑名单加载] 加载路径: ${blacklistPath}`)
    
    if (fs.existsSync(blacklistPath)) {
      const data = JSON.parse(fs.readFileSync(blacklistPath, { encoding: 'utf-8' }))
      
      // 版本兼容性检查
      const version = data.version || '1.0'
      console.log(`[黑名单加载] 文件版本: ${version}, 当前支持版本: 2.0`)
      
      let blacklistMap = new Map()
      
      if (version === '2.0') {
        // 新格式：对象结构
        const blacklistObj = data.blacklist || {}
        for (const [bookId, item] of Object.entries(blacklistObj)) {
          const key = `${bookId}|${item.filename}`
          blacklistMap.set(key, {
            reason: item.reason || '未知原因',
            filename: item.filename,
            fullPath: item.fullPath,
            addedAt: item.addedAt || data.lastUpdate || new Date().toISOString()
          })
        }
      } else if (version === '1.1') {
        // 1.1版本：数组结构
        const blacklistArray = data.blacklist || []
        blacklistArray.forEach(item => {
          if (typeof item === 'object' && item.key) {
            blacklistMap.set(item.key, {
              reason: item.reason,
              addedAt: item.addedAt
            })
          }
        })
      } else if (version === '1.0') {
        // 旧版本：简单数组
        const blacklistArray = data.blacklist || []
        blacklistArray.forEach(item => {
          if (typeof item === 'string') {
            blacklistMap.set(item, {
              reason: '自动添加',
              addedAt: data.lastUpdate || new Date().toISOString()
            })
          }
        })
      }
      
      console.log(`[黑名单加载] ✅ 加载成功! 黑名单数量: ${blacklistMap.size}`)
      return blacklistMap
    } else {
      console.log(`[黑名单加载] ℹ️ 文件不存在，返回空黑名单`)
    }
  } catch (e) {
    console.log('[黑名单加载] ❌ 加载失败:', e)
  }
  return new Map()
}

const saveBlacklist = (blacklistMap) => {
  try {
    const blacklistPath = getBlacklistPath()
    console.log(`[黑名单保存] STORE_PATH: ${STORE_PATH}`)
    console.log(`[黑名单保存] 保存路径: ${blacklistPath}`)
    console.log(`[黑名单保存] 黑名单数量: ${blacklistMap.size}`)
    
    // 转换为2.0版本的对象格式
    const blacklistObj = {}
    for (const [key, data] of blacklistMap.entries()) {
      // 从key中解析bookId和filename，格式为 "bookId|filename"
      const parts = key.split('|')
      const bookId = parts[0]
      const filename = parts.slice(1).join('|') // 处理文件名中可能包含|的情况
      
      blacklistObj[bookId] = {
        filename: data.filename || filename,
        fullPath: data.fullPath || '',
        reason: data.reason || '未知原因'
      }
    }
    
    const data = {
      version: '2.0',
      lastUpdate: new Date().toISOString(),
      blacklist: blacklistObj
    }
    
    fs.writeFileSync(blacklistPath, JSON.stringify(data, null, 2), { encoding: 'utf-8' })
    
    // 验证文件是否真的被写入
    if (fs.existsSync(blacklistPath)) {
      const fileSize = fs.statSync(blacklistPath).size
      console.log(`[黑名单保存] ✅ 保存成功! 文件大小: ${fileSize} 字节`)
    } else {
      console.log(`[黑名单保存] ⚠️ 文件未找到，写入可能失败`)
    }
    
    return true
  } catch (e) {
    console.log('[黑名单保存] ❌ 保存失败:', e)
    return false
  }
}

const clearBlacklist = () => {
  try {
    const blacklistPath = getBlacklistPath()
    if (fs.existsSync(blacklistPath)) {
      fs.unlinkSync(blacklistPath)
    }
    return true
  } catch (e) {
    console.log('Clear blacklist error:', e)
    return false
  }
}

module.exports = {
  STORE_PATH,
  isPortable,
  TEMP_PATH,
  COVER_PATH,
  VIEWER_PATH,
  prepareSetting,
  prepareCollectionList,
  preparePath,
  loadBlacklist,
  saveBlacklist,
  clearBlacklist,
  getBlacklistPath
}