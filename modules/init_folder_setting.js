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
      allowFolderAsManga: false, // 新增，默认关闭
      skipBlacklistInBatchMetadata: true // 批量获取元数据时跳过黑名单文件，默认开启
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
      
      // 检查版本，支持向后兼容
      if (data.version === '2.0' && data.blacklist && typeof data.blacklist === 'object') {
        // 新格式：对象格式
        const blacklistMap = new Map()
        for (const [hash, info] of Object.entries(data.blacklist)) {
          blacklistMap.set(hash, {
            filename: info.filename || '',
            fullPath: info.fullPath || ''
          })
        }
        console.log(`[黑名单加载] ✅ 加载成功! 新格式黑名单数量: ${blacklistMap.size}`)
        return blacklistMap
      } else if (data.version === '1.0' && Array.isArray(data.blacklist)) {
        // 旧格式：数组格式，需要迁移
        console.log(`[黑名单加载] ℹ️ 检测到旧格式黑名单，正在迁移...`)
        const blacklistMap = new Map()
        for (const hash of data.blacklist) {
          blacklistMap.set(hash, {
            filename: '', // 旧格式没有文件名信息
            fullPath: ''  // 旧格式没有路径信息
          })
        }
        // 保存为新格式
        saveBlacklist(blacklistMap)
        console.log(`[黑名单加载] ✅ 迁移完成! 黑名单数量: ${blacklistMap.size}`)
        return blacklistMap
      } else {
        console.log(`[黑名单加载] ⚠️ 未知的黑名单格式，使用空黑名单`)
      }
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
    
    // 转换为对象格式
    const blacklistObj = {}
    for (const [hash, info] of blacklistMap) {
      blacklistObj[hash] = {
        filename: info.filename || '',
        fullPath: info.fullPath || ''
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