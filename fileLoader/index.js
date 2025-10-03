const fs = require('fs')
const path = require('node:path')
const { nanoid } = require('nanoid')
const { createHash } = require('crypto')
const sharp = require('sharp')
const {
  getFolderlist,
  solveBookTypeFolderInMem,
  solveBookTypeFolder,
  getImageListFromFolder,
  deleteImageFromFolder
} = require('./folder.js')
const {
  getArchivelist,
  solveBookTypeArchive,
  getImageListFromArchive,
  deleteImageFromArchive,
  solveBookTypeArchiveInMem,
  geneCoverSharp
} = require('./archive.js')
const { makeShardedPath  } = require('./utils.js')

const { getZipFilelist, solveBookTypeZip } = require('./zip.js')
const { TEMP_PATH, COVER_PATH, VIEWER_PATH } = require('../modules/init_folder_setting.js')

const getBookFilelist = async (library) => {
  const { prepareSetting, STORE_PATH } = require('../modules/init_folder_setting.js')
  const fs = require('fs')
  const path = require('path')
  const setting = prepareSetting()
  // 黑名单文件路径优先使用 setting.zipBlacklistPath，否则默认 STORE_PATH/zip_blacklist.json
  const zipBlacklistPath = setting.zipBlacklistPath || path.join(STORE_PATH, 'zip_blacklist.json')
  let zipBlacklist = []
  try {
    if (fs.existsSync(zipBlacklistPath)) {
      const data = JSON.parse(fs.readFileSync(zipBlacklistPath, { encoding: 'utf-8' }))
      zipBlacklist = Array.isArray(data.blacklist) ? data.blacklist : []
    }
  } catch (e) {
    console.log('读取zip黑名单失败:', e)
  }
  const archiveList = await getArchivelist(library)
  let zipList = await getZipFilelist(library)
  // 跳过黑名单中的压缩包路径
  zipList = zipList.filter(filepath => !zipBlacklist.includes(filepath))
  let result = [
    ...archiveList.map(filepath => ({ filepath, type: 'archive' })),
    ...zipList.map(filepath => ({ filepath, type: 'zip' })),
  ]
  if (setting.allowFolderAsManga) {
    const folderList = await getFolderlist(library)
    result = [
      ...folderList.map(filepath => ({ filepath, type: 'folder' })),
      ...result
    ]
  }
  return result
}

const geneCover = async (filepath, type) => {
  let targetFilePath, tempCoverPath, pageCount, bundleSize, mtime
  switch (type) {
    case 'folder':
      ;({ targetFilePath, tempCoverPath, pageCount, bundleSize, mtime } = await solveBookTypeFolder(filepath, TEMP_PATH))
      break
    case 'zip':
      try {
        ;({ targetFilePath, tempCoverPath, pageCount, bundleSize, mtime } = await solveBookTypeArchive(filepath, TEMP_PATH))
      } catch (e) {
        console.log(`reload ${filepath} use adm-zip`)
        ;({ targetFilePath, tempCoverPath, pageCount, bundleSize, mtime } = await solveBookTypeZip(filepath, TEMP_PATH))
      }
      break
    case 'archive':
      ;({ targetFilePath, tempCoverPath, pageCount, bundleSize, mtime } = await solveBookTypeArchive(filepath, TEMP_PATH))
      break
  }

  const coverHash = createHash('sha256').update(fs.readFileSync(tempCoverPath)).digest('hex')
  const copyTempCoverPath = path.join(TEMP_PATH, nanoid(8) + path.extname(tempCoverPath))
  const coverPath = makeShardedPath(COVER_PATH,  coverHash+'.webp')
  await fs.promises.mkdir(path.dirname(coverPath), { recursive: true })
  await fs.promises.copyFile(tempCoverPath, copyTempCoverPath)
  await sharp(copyTempCoverPath, { failOnError: false })
    .resize(500, 707, {
      fit: 'contain',
      background: '#303133'
    })
    .toFile(coverPath)
  return { targetFilePath, coverPath, pageCount, bundleSize, mtime, coverHash }
}

const getImageListByBook = async (filepath, type) => {
  switch (type) {
    case 'folder':
      return await getImageListFromFolder(filepath, VIEWER_PATH)
    case 'zip':
    case 'archive':
      return await getImageListFromArchive(filepath, VIEWER_PATH)
    default:
      return await getImageListFromArchive(filepath, VIEWER_PATH)
  }
}

const deleteImageFromBook = async (filename, filepath, type) => {
  switch (type) {
    case 'folder':
      return await deleteImageFromFolder(filename, filepath)
    case 'zip':
    case 'archive':
      return await deleteImageFromArchive(filename, filepath)
    default:
      return await deleteImageFromArchive(filename, filepath)
  }
}

const geneCoverFromBuffer = async (filepath, type, opts={}) => {

  let targetBuffer, coverBuffer, pageCount, bundleSize, mtime, useBuffer, targetFilePath, tempCoverPath,
      hash, coverHash, coverSharp,coverPath
  if (type === 'folder') {
    ({
      targetBuffer,
      coverBuffer,
      pageCount,
      bundleSize,
      mtime
    } = await solveBookTypeFolderInMem(filepath))
    useBuffer = true
  } else {
    try {
      ({
        targetBuffer,
        coverBuffer,
        pageCount,
        bundleSize,
        mtime
      } = await solveBookTypeArchiveInMem(filepath, opts))
      useBuffer = true
    } catch (e1) {
      console.log(`reload ${filepath} by 7z`)
      try {
        ({
          targetFilePath,
          tempCoverPath,
          pageCount,
          bundleSize,
          mtime
        } = await solveBookTypeArchive(filepath, TEMP_PATH, opts))
        useBuffer = false
      } catch (e2) {
        console.log(`reload ${filepath} use adm-zip`);
        ({
          targetFilePath,
          tempCoverPath,
          pageCount,
          bundleSize,
          mtime
        } = await solveBookTypeZip(filepath, TEMP_PATH, opts))
        useBuffer = false
      }
    }
  }
  if (useBuffer) {
    hash = createHash('sha1').update(targetBuffer).digest('hex')
    coverHash = createHash('sha256').update(coverBuffer).digest('hex')
    coverSharp = await geneCoverSharp(coverBuffer);
    coverPath = makeShardedPath(COVER_PATH, coverHash + '.webp')
    // the simple version may cause pngload_buffer or vipsjpeg error

  } else {
    hash = createHash('sha1').update(fs.readFileSync(targetFilePath)).digest('hex')
    coverHash = createHash('sha256').update(fs.readFileSync(tempCoverPath)).digest('hex')
    const copyTempCoverPath = path.join(TEMP_PATH, nanoid(8) + path.extname(tempCoverPath))
    await fs.promises.copyFile(tempCoverPath, copyTempCoverPath)
    coverPath = makeShardedPath(COVER_PATH, coverHash + '.webp')
    coverSharp = await sharp(copyTempCoverPath, { failOnError: false })
        .resize(500, 707, {
          fit: 'contain',
          background: '#303133'
        })
  }
  return { hash, coverPath, pageCount, bundleSize, mtime, coverHash, coverSharp }
}

module.exports = {
  getBookFilelist,
  geneCover,
  getImageListByBook,
  deleteImageFromBook,
  geneCoverFromBuffer,
  makeShardedPath
}