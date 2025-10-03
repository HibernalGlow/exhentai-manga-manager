const fs = require('fs')
const path = require('path')
const blacklistPath = path.join(__dirname, '../resources/extraResources/zip_blacklist.json')
function addToZipBlacklist(filepath) {
  let data = { version: '1.0', lastUpdate: new Date().toISOString(), blacklist: [] }
  try {
    if (fs.existsSync(blacklistPath)) {
      data = JSON.parse(fs.readFileSync(blacklistPath, { encoding: 'utf-8' }))
    }
    if (!data.blacklist.includes(filepath)) {
      data.blacklist.push(filepath)
      data.lastUpdate = new Date().toISOString()
      fs.writeFileSync(blacklistPath, JSON.stringify(data, null, 2), { encoding: 'utf-8' })
      console.log(`已加入黑名单: ${filepath}`)
      return true
    }
    return false
  } catch (e) {
    console.log('写入zip黑名单失败:', e)
    return false
  }
}
const { globSync } = require('glob')
const AdmZip = require('adm-zip')
const { nanoid } = require('nanoid')
const _ = require('lodash')
const { makeShardedPath  } = require('./utils.js')

const getZipFilelist = async (libraryPath) => {
  const list = globSync('**/*.@(zip|cbz)', {
    cwd: libraryPath,
    nocase: true,
    nodir: true,
    follow: true,
    absolute: true
  })
  return list
}

const solveBookTypeZip = async (filepath, TEMP_PATH, opts = {}) => {
  const {signal} = opts
  signal?.throwIfAborted?.()
  const tempFolder = path.join(TEMP_PATH, nanoid(8))
  await fs.promises.mkdir(tempFolder, { recursive: true })

  let zip, zipFileList, fileList, imageList
  try {
    zip = new AdmZip(filepath)
    zipFileList = zip.getEntries()
    fileList = zipFileList.map(zFile => zFile.entryName)
    imageList = _.filter(fileList, filepath => _.includes(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif'], path.extname(filepath).toLowerCase()))
    imageList = imageList.sort((a, b) => a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'}))
  } catch (e) {
    const added = addToZipBlacklist(filepath)
    const msg = added ? ' (已加入黑名单)' : ''
    throw new Error('ADM-ZIP: Invalid or unsupported zip format. ' + e.message + msg)
  }

  let targetFile
  let targetFilePath
  let coverFile
  let tempCoverPath
  let coverPath
  if (imageList.length > 8) {
    targetFile = imageList[7]
    coverFile = imageList[0]
    zip.extractEntryTo(_.find(zipFileList, zFile => zFile.entryName === targetFile), tempFolder, true, true)
    zip.extractEntryTo(_.find(zipFileList, zFile => zFile.entryName === coverFile), tempFolder, true, true)
  } else if (imageList.length > 0) {
    targetFile = imageList[0]
    coverFile = imageList[0]
    zip.extractEntryTo(_.find(zipFileList, zFile => zFile.entryName === targetFile), tempFolder, true, true)
  } else {
    const added = addToZipBlacklist(filepath)
    const msg = added ? ' (已加入黑名单)' : ''
    throw new Error('compression package isnot include image' + msg)
  }

  targetFilePath = path.join(TEMP_PATH, nanoid(8) + path.extname(targetFile))
  await fs.promises.copyFile(path.join(tempFolder, targetFile), targetFilePath)

  tempCoverPath = path.join(TEMP_PATH, nanoid(8) + path.extname(imageList[0]))
  await fs.promises.copyFile(path.join(tempFolder, imageList[0]), tempCoverPath)

  const fileStat = await fs.promises.stat(filepath)
  return {targetFilePath, tempCoverPath, pageCount: imageList.length, bundleSize: fileStat?.size, mtime: fileStat?.mtime}
}

const getImageListFromZip = async (filepath, VIEWER_PATH) => {
  const zip = new AdmZip(filepath)
  const tempFolder = path.join(VIEWER_PATH, nanoid(8))
  zip.extractAllTo(tempFolder, true)
  let list = globSync('**/*.@(jpg|jpeg|png|webp|avif|gif)', {
    cwd: tempFolder,
    nocase: true
  })
  list = _.filter(list, s => !_.includes(s, '__MACOSX'))
  list = list.sort((a, b) => a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'}))
  return list.map(f => ({
    relativePath: f,
    absolutePath: path.join(tempFolder, f)
  }))
}

module.exports = {
  getZipFilelist,
  solveBookTypeZip,
  getImageListFromZip
}