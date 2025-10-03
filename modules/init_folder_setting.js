const { app } = require('electron')
const fs = require('fs')
const path = require('path')
const { getRootPath } = require('./utils.js')


let STORE_PATH = app.getPath('userData')
if (!fs.existsSync(STORE_PATH)) {
  fs.mkdirSync(STORE_PATH)
}
const rootPath = getRootPath()
let isPortable = false
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
    STORE_PATH = app.getPath('userData')
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
      const blacklistSet = new Set(data.blacklist || [])
      console.log(`[黑名单加载] ✅ 加载成功! 黑名单数量: ${blacklistSet.size}`)
      return blacklistSet
    } else {
      console.log(`[黑名单加载] ℹ️ 文件不存在，返回空黑名单`)
    }
  } catch (e) {
    console.log('[黑名单加载] ❌ 加载失败:', e)
  }
  return new Set()
}

const saveBlacklist = (blacklistSet) => {
  try {
    const blacklistPath = getBlacklistPath()
    console.log(`[黑名单保存] STORE_PATH: ${STORE_PATH}`)
    console.log(`[黑名单保存] 保存路径: ${blacklistPath}`)
    console.log(`[黑名单保存] 黑名单数量: ${blacklistSet.size}`)
    
    const data = {
      version: '1.0',
      lastUpdate: new Date().toISOString(),
      blacklist: Array.from(blacklistSet)
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