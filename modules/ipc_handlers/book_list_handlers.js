/**
 * 书籍列表加载和生成处理器
 * 包含load-book-list和force-gene-book-list两个大型处理器
 */

const { ipcMain } = require('electron')
const { performance } = require('node:perf_hooks')
const path = require('path')
const _ = require('lodash')

/**
 * 注册书籍列表相关的IPC处理器
 */
function registerBookListHandlers(dependencies) {
  const {
    Manga,
    Metadata,
    setting,
    sendMessageToWebContents,
    setProgressBar,
    createAbortableContext,
    createLimiter,
    pathExists,
    coverAndHashInMem,
    scanLibraryFilesWithExclude,
    findSameFile,
    makeShardedPath,
    COVER_PATH,
    STORE_PATH,
    isPortable,
    loadBookListFromDatabase,
    saveBookToDatabase,
    metadataSqliteFile,
    shell
  } = dependencies
  
  // 准备 loadBookListFromDatabase 的依赖
  const dbDependencies = {
    Manga,
    Metadata,
    metadataSqliteFile,
    STORE_PATH,
    shell
  }

  // ==================== load-book-list处理器 ====================
  ipcMain.handle('load-book-list', async (event, scan) => {
    if (scan) {
      sendMessageToWebContents('Start loading library')

      const context = createAbortableContext(event)
      const { signal } = context.controller
      
      try {
        const bookList = await Manga.findAll({ raw: true })
        const byFilepath = new Map(bookList.map(b => [b.filepath, b]))
        const byId = new Map(bookList.map(b => [b.id, b]))

        let list = await scanLibraryFilesWithExclude()
        const listLength = list.length
        sendMessageToWebContents(`Load ${listLength} book from library`)
        
        if (listLength === 0) {
          setProgressBar(-1)
          return await loadBookListFromDatabase(dbDependencies)
        }

        const tTotal0 = performance.now()
        const workLimit = createLimiter(setting.concurrentScan)
        const coverLimit = createLimiter(setting.concurrentWrite)
        const dbLimit = createLimiter(1)
        const BATCH_SIZE = 50
        let processed = 0

        for (let offset = 0; offset < listLength; offset += BATCH_SIZE) {
          signal?.throwIfAborted?.()
          const chunk = list.slice(offset, Math.min(offset + BATCH_SIZE, listLength))
          const chunkBooks = []

          const chunkTasks = chunk.map(({ filepath, type }, j) => {
            return workLimit(async () => {
              signal?.throwIfAborted?.()
              const globalIdx = offset + j
              
              try {
                let found = byFilepath.get(filepath)
                if (found) {
                  found.exist = true
                  if (isPortable) {
                    const newCoverPath = makeShardedPath(COVER_PATH, path.basename(found.coverPath))
                    if (found.coverPath !== newCoverPath) {
                      found.coverPath = newCoverPath
                      chunkBooks.push(found)
                    }
                  }
                  return
                }

                const existingManga = await findSameFile(filepath, type, Manga)
                if (existingManga) {
                  const prev = byId.get(existingManga.id) || null
                  if (prev) {
                    const exist = await pathExists(prev.filepath)
                    if (!exist) {
                      // File relocated
                      existingManga.filepath = filepath
                      chunkBooks.push(existingManga)
                      sendMessageToWebContents(`Relocated: ${filepath}`)
                      return
                    }
                  }
                  // Duplicate file
                  sendMessageToWebContents(`Duplicate: ${filepath}`)
                  return
                }

                // New file
                const coverData = await coverAndHashInMem(filepath, type, { signal, COVER_PATH })
                if (coverData.coverPath && coverData.hash) {
                  const { nanoid } = require('nanoid')
                  const id = nanoid()
                  const newBook = {
                    title: path.basename(filepath),
                    coverPath: coverData.coverPath,
                    hash: coverData.hash,
                    filepath,
                    type,
                    id,
                    pageCount: coverData.pageCount,
                    bundleSize: coverData.bundleSize,
                    mtime: coverData.mtime,
                    coverHash: coverData.coverHash,
                    tags: '{}'
                  }
                  
                  // Write cover
                  await coverLimit(async () => {
                    const fs = require('fs')
                    await fs.promises.writeFile(coverData.coverPath, coverData.coverSharp)
                  })
                  
                  chunkBooks.push(newBook)
                  sendMessageToWebContents(`New: ${filepath}`)
                }
              } catch (e) {
                sendMessageToWebContents(`Error loading ${filepath}: ${e.message}`)
              }
              
              processed++
              if (processed % 50 === 0) {
                const progress = processed / listLength
                setProgressBar(progress)
                sendMessageToWebContents(`Progress: ${processed}/${listLength}`)
              }
            })
          })

          await Promise.allSettled(chunkTasks)

          // Batch DB write
          if (chunkBooks.length > 0) {
            await dbLimit(async () => {
              const transaction = await Manga.sequelize.transaction()
              try {
                for (const book of chunkBooks) {
                  if (book.id && byId.has(book.id)) {
                    await Manga.update(book, { where: { id: book.id }, transaction })
                  } else {
                    await Manga.create(book, { transaction })
                  }
                }
                await transaction.commit()
              } catch (e) {
                await transaction.rollback()
                throw e
              }
            })
          }
        }

      const tTotal1 = performance.now()
      sendMessageToWebContents(`Completed in : ${((tTotal1 - tTotal0) / 1000).toFixed(2)} s`)
      setProgressBar(-1)
      
      return await loadBookListFromDatabase(dbDependencies)
    } catch (error) {
      setProgressBar(-1)
      sendMessageToWebContents(`Error: ${error.message}`)
      throw error
    }
  } else {
    return await loadBookListFromDatabase(dbDependencies)
  }
  })

  // ==================== force-gene-book-list处理器 ====================
  ipcMain.handle('force-gene-book-list', async (event, arg) => {
    sendMessageToWebContents('Start force rebuilding library')
    
    const context = createAbortableContext(event)
    const { signal } = context.controller
    
    try {
      let list = await scanLibraryFilesWithExclude()
      const listLength = list.length
      sendMessageToWebContents(`Found ${listLength} files`)
      
      if (listLength === 0) {
        setProgressBar(-1)
        return await loadBookListFromDatabase(dbDependencies)
      }

      const tTotal0 = performance.now()
      const workLimit = createLimiter(setting.concurrentScan)
      const coverLimit = createLimiter(setting.concurrentWrite)
      const dbLimit = createLimiter(1)
      const BATCH_SIZE = 50
      let processed = 0
      
      // Clear existing database
      await Manga.destroy({ where: {}, truncate: true })
      sendMessageToWebContents('Database cleared')

      for (let offset = 0; offset < listLength; offset += BATCH_SIZE) {
        signal?.throwIfAborted?.()
        const chunk = list.slice(offset, Math.min(offset + BATCH_SIZE, listLength))
        const chunkBooks = []

        const chunkTasks = chunk.map(({ filepath, type }) => {
          return workLimit(async () => {
            signal?.throwIfAborted?.()
            
            try {
              const coverData = await coverAndHashInMem(filepath, type, { signal, COVER_PATH })
              if (coverData.coverPath && coverData.hash) {
                const { nanoid } = require('nanoid')
                const id = nanoid()
                const newBook = {
                  title: path.basename(filepath),
                  coverPath: coverData.coverPath,
                  hash: coverData.hash,
                  filepath,
                  type,
                  id,
                  pageCount: coverData.pageCount,
                  bundleSize: coverData.bundleSize,
                  mtime: coverData.mtime,
                  coverHash: coverData.coverHash,
                  tags: '{}'
                }
                
                // Write cover
                await coverLimit(async () => {
                  const fs = require('fs')
                  await fs.promises.writeFile(coverData.coverPath, coverData.coverSharp)
                })
                
                chunkBooks.push(newBook)
              }
            } catch (e) {
              sendMessageToWebContents(`Error: ${filepath}: ${e.message}`)
            }
            
            processed++
            if (processed % 50 === 0) {
              const progress = processed / listLength
              setProgressBar(progress)
              sendMessageToWebContents(`Progress: ${processed}/${listLength}`)
            }
          })
        })

        await Promise.allSettled(chunkTasks)

        // Batch DB write
        if (chunkBooks.length > 0) {
          await dbLimit(async () => {
            await Manga.bulkCreate(chunkBooks)
          })
        }
      }

      const tTotal1 = performance.now()
      sendMessageToWebContents(`Force rebuild completed in : ${((tTotal1 - tTotal0) / 1000).toFixed(2)} s`)
      setProgressBar(-1)
      
      return await loadBookListFromDatabase(dbDependencies)
    } catch (error) {
      setProgressBar(-1)
      sendMessageToWebContents(`Error: ${error.message}`)
      throw error
    }
  })

  console.log('✅ 书籍列表处理器已注册')
}

module.exports = {
  registerBookListHandlers
}


