/**
 * 元数据修补相关的IPC处理器
 */

const { ipcMain } = require('electron')
const fs = require('fs')
const path = require('path')
const { createHash } = require('crypto')
const _ = require('lodash')

function registerMetadataPatchHandlers(dependencies) {
  const {
    Manga,
    Metadata,
    sendMessageToWebContents,
    setProgressBar,
    TEMP_PATH,
    COVER_PATH,
    loadBookListFromDatabase,
    saveBookToDatabase,
    clearFolder,
    createLimiter,
    setting,
    createAbortableContext,
    pathExists,
    coverAndHashInMem,
    geneCover,
    geneCoverFromBuffer,
    makeShardedPath
  } = dependencies

  // patch-local-metadata: 重建数据库中的所有书籍元数据
  ipcMain.handle('patch-local-metadata', async (event, arg) => {
    const bookList = await loadBookListFromDatabase({ Manga, Metadata })
    const bookListLength = bookList.length
    await clearFolder(TEMP_PATH)
    await clearFolder(COVER_PATH)

    const context = createAbortableContext(event)
    const { signal } = context.controller

    const workLimit = createLimiter(setting.concurrentScan)
    const coverLimit = createLimiter(setting.concurrentWrite)
    const dbLimit = createLimiter(1)
    const BATCH_SIZE = 100
    let processed = 0

    for (let offset = 0; offset < bookListLength; offset += BATCH_SIZE) {
      signal?.throwIfAborted?.()
      const chunk = bookList.slice(offset, Math.min(offset + BATCH_SIZE, bookListLength))
      const chunkTasks = chunk.map((book) => {
        return workLimit(async () => {
          signal?.throwIfAborted?.()
          try {
            console.log("patching", book)
            const { filepath } = book
            const exists = await pathExists(filepath)
            if (!exists) {
              sendMessageToWebContents(`Skip (missing): ${filepath}`)
              return
            }
            const type = book.type || 'archive'
            const result = await coverAndHashInMem(filepath, type, { signal })
            const { coverPath, pageCount, bundleSize, mtime, coverHash, hash, coverSharp } = result
            
            _.assign(book, { 
              type, 
              coverPath, 
              hash, 
              pageCount, 
              bundleSize, 
              mtime: mtime instanceof Date ? mtime.toJSON() : mtime, 
              coverHash 
            })

            await coverLimit(async () => {
              await fs.promises.mkdir(path.dirname(coverPath), { recursive: true })
              if (Buffer.isBuffer(coverSharp)) {
                await fs.promises.writeFile(coverPath, coverSharp)
              } else if (typeof coverSharp?.toFile === 'function') {
                await coverSharp.toFile(coverPath)
              }
            })
            signal?.throwIfAborted?.()
            await dbLimit(() => saveBookToDatabase(book))
          } catch (e) {
            if (e?.name === 'AbortError') throw e
            if (e?.code === 'ENOENT' || e?.code === 'ENOTDIR') {
              sendMessageToWebContents(`Skip (disappeared): ${book.filepath}`)
              return
            }
            sendMessageToWebContents(`Patch ${book.filepath} failed because ${e}`)
          }
        })
      })
      const results = await Promise.allSettled(chunkTasks)

      if (results.some(r => r.status === 'rejected' && r.reason?.name === 'AbortError')) {
        throw Object.assign(new Error('Scan aborted'), { name: 'AbortError' })
      }
      processed += chunk.length
      setProgressBar(processed / bookListLength)
    }

    await clearFolder(TEMP_PATH)
    setProgressBar(-1)
    return bookList
  })

  // _patch-local-metadata: 内部版本（使用geneCover）
  ipcMain.handle('_patch-local-metadata', async (event, arg) => {
    const bookList = await loadBookListFromDatabase({ Manga, Metadata })
    const bookListLength = bookList.length
    await clearFolder(TEMP_PATH)
    await clearFolder(COVER_PATH)

    for (let i = 0; i < bookListLength; i++) {
      try {
        const book = bookList[i]
        let { filepath, type } = book
        if (!type) type = 'archive'
        const { targetFilePath, coverPath, pageCount, bundleSize, mtime, coverHash } = await geneCover(filepath, type)
        if (targetFilePath && coverPath) {
          const hash = createHash('sha1').update(fs.readFileSync(targetFilePath)).digest('hex')
          _.assign(book, { type, coverPath, hash, pageCount, bundleSize, mtime: mtime.toJSON(), coverHash })
          await saveBookToDatabase(book)
        }
        if ((i + 1) % 50 === 0) await clearFolder(TEMP_PATH)
        setProgressBar(i / bookListLength)
      } catch (e) {
        sendMessageToWebContents(`Patch ${bookList[i].filepath} failed because ${e}`)
      }
    }

    await clearFolder(TEMP_PATH)
    setProgressBar(-1)
    return bookList
  })

  // patch-local-metadata-by-book: 重新扫描单本书
  ipcMain.handle('patch-local-metadata-by-book', async (event, book) => {
    let { filepath, type } = book
    if (!type) type = 'archive'
    try {
      const { targetFilePath, coverPath, pageCount, bundleSize, mtime, coverHash } = await geneCover(filepath, type)
      if (targetFilePath && coverPath) {
        const hash = createHash('sha1').update(fs.readFileSync(targetFilePath)).digest('hex')
        await clearFolder(TEMP_PATH)
        return Promise.resolve({ 
          coverPath, 
          hash, 
          pageCount, 
          bundleSize, 
          mtime: mtime.toJSON(), 
          coverHash 
        })
      }
    } catch (e) {
      sendMessageToWebContents(`Patch ${book.filepath} failed because ${e}`)
      await clearFolder(TEMP_PATH)
      return Promise.reject(e)
    }
  })

  // repair-missing-covers: 修复缺失的封面
  ipcMain.handle('repair-missing-covers', async (event, arg) => {
    const bookList = await loadBookListFromDatabase({ Manga, Metadata })
    const bookListLength = bookList.length
    let repairedCount = 0

    sendMessageToWebContents(`开始检查并修复缺失的封面...`)

    const context = createAbortableContext(event)
    const { signal } = context.controller

    const workLimit = createLimiter(setting.concurrentScan)
    const coverLimit = createLimiter(setting.concurrentWrite)
    const dbLimit = createLimiter(1)
    const BATCH_SIZE = 50

    for (let offset = 0; offset < bookListLength; offset += BATCH_SIZE) {
      signal?.throwIfAborted?.()
      const chunk = bookList.slice(offset, Math.min(offset + BATCH_SIZE, bookListLength))
      const chunkTasks = chunk.map((book) => {
        return workLimit(async () => {
          signal?.throwIfAborted?.()
          try {
            const { coverPath } = book
            const coverExists = await fs.promises.access(coverPath).then(() => true).catch(() => false)

            if (!coverExists) {
              sendMessageToWebContents(`修复缺失封面: ${book.filepath}`)
              const { filepath, type } = book
              const fileType = type || 'archive'

              const fileExists = await fs.promises.access(filepath).then(() => true).catch(() => false)
              if (!fileExists) {
                sendMessageToWebContents(`跳过 (文件不存在): ${filepath}`)
                return
              }

              const result = await geneCoverFromBuffer(filepath, fileType, { signal })
              const { coverSharp, coverHash: newCoverHash } = result

              if (coverSharp && newCoverHash) {
                const newCoverPath = makeShardedPath(COVER_PATH, newCoverHash + '.webp')

                await coverLimit(async () => {
                  await fs.promises.mkdir(path.dirname(newCoverPath), { recursive: true })
                  if (Buffer.isBuffer(coverSharp)) {
                    await fs.promises.writeFile(newCoverPath, coverSharp)
                  } else if (typeof coverSharp?.toFile === 'function') {
                    await coverSharp.toFile(newCoverPath)
                  }
                })

                book.coverPath = newCoverPath
                book.coverHash = newCoverHash

                await dbLimit(() => saveBookToDatabase(book))
                repairedCount++
              }
            }
          } catch (e) {
            if (e?.name === 'AbortError') throw e
            sendMessageToWebContents(`修复 ${book.filepath} 失败: ${e.message}`)
          }
        })
      })

      const results = await Promise.allSettled(chunkTasks)

      if (results.some(r => r.status === 'rejected' && r.reason?.name === 'AbortError')) {
        throw Object.assign(new Error('修复已中止'), { name: 'AbortError' })
      }

      const processed = offset + chunk.length
      setProgressBar(processed / bookListLength)
    }

    await clearFolder(TEMP_PATH)
    setProgressBar(-1)
    sendMessageToWebContents(`封面修复完成，共修复 ${repairedCount} 个缺失封面`)
    return { repairedCount }
  })

  // fill-no-category-metadata: 填充无分类元数据
  ipcMain.handle('fill-no-category-metadata', async (event, bookList) => {
    sendMessageToWebContents('开始填充无分类元数据...')
    
    for (const book of bookList) {
      if (!book.category || book.category === 'non-tag') {
        try {
          // 这里可以添加自动分类逻辑
          // 暂时只是更新状态
          await saveBookToDatabase(book)
        } catch (e) {
          sendMessageToWebContents(`填充 ${book.filepath} 元数据失败: ${e.message}`)
        }
      }
    }
    
    sendMessageToWebContents('无分类元数据填充完成')
    return bookList
  })
}

module.exports = {
  registerMetadataPatchHandlers
}


