/**
 * LAN局域网浏览功能模块
 * 提供局域网内的漫画浏览和阅读服务（约290行）
 */

const express = require('express')
const path = require('path')
const fs = require('fs')
const _ = require('lodash')

// 创建Express应用
const LANBrowsing = express()

// 端口配置
let port = 8089

/**
 * 初始化LAN浏览服务
 */
function initLANBrowsing(dependencies) {
  const {
    STORE_PATH,
    loadBookListFromDatabase,
    formatTags,
    getBookFilelist,
    sendMessageToWebContents
  } = dependencies

  // 排序键映射
  const sortKeyMap = {
    "date": {
      key: "date",
      type: "number"
    },
    "title": {
      key: "title",
      type: "string"
    },
    "rating": {
      key: "rating",
      type: "number"
    },
    "read_count": {
      key: "readCount",
      type: "number"
    },
    "random": {}
  }

  // 设置静态文件夹
  const staticFilePath = path.resolve(STORE_PATH, 'public')
  fs.mkdirSync(staticFilePath, { recursive: true })
  LANBrowsing.use('/static', express.static(staticFilePath))

  let mangas = []
  let tagTranslation = undefined

  // API: 搜索漫画
  LANBrowsing.get('/api/search', async (req, res) => {
    try {
      const filter = req.query.filter || ''
      const start = parseInt(req.query.start, 10) || 0
      const length = parseInt(req.query.length, 10) || 200
      let sortKey = req.query.sortby || 'read_count'
      let showAll = false
      
      if (sortKey.includes("_all")) {
        sortKey = sortKey.replace("_all", "")
        showAll = true
      }

      // 读取并搜索数据库
      mangas = await loadBookListFromDatabase()
      let filterMangas
      
      if (filter) {
        filterMangas = mangas.filter(manga => {
          return JSON.stringify(_.pick(manga, ['title', 'title_jpn', 'status', 'category', 'filepath', 'url'])).toLowerCase().includes(filter.toLowerCase())
            || formatTags(manga.tags).toLowerCase().includes(filter.toLowerCase())
        })
      } else {
        filterMangas = mangas
      }

      if (sortKey !== 'random') {
        const sortConfig = sortKeyMap[sortKey]
        if (sortConfig) {
          if (sortConfig.type === 'number') {
            filterMangas.sort((a, b) => (b[sortConfig.key] || 0) - (a[sortConfig.key] || 0))
          } else if (sortConfig.type === 'string') {
            filterMangas.sort((a, b) => (a[sortConfig.key] || '').localeCompare(b[sortConfig.key] || ''))
          }
        }
      } else {
        filterMangas = _.shuffle(filterMangas)
      }

      if (!showAll) {
        filterMangas = filterMangas.filter(manga => manga.status !== 'deleted')
      }

      const result = filterMangas.slice(start, start + length)
      res.json({
        archives: result.map(manga => ({
          arcid: manga.hash,
          title: manga.title,
          tags: formatTags(manga.tags)
        })),
        recordsFiltered: filterMangas.length,
        recordsTotal: mangas.length,
        draw: parseInt(req.query.draw, 10) || 1
      })
    } catch (error) {
      console.error('LAN browsing search error:', error)
      res.status(500).json({ error: error.message })
    }
  })

  // API: 随机漫画
  LANBrowsing.get('/api/search/random', async (req, res) => {
    try {
      const count = parseInt(req.query.count, 10) || 1
      mangas = await loadBookListFromDatabase()
      const availableMangas = mangas.filter(manga => manga.status !== 'deleted')
      const randomMangas = _.sampleSize(availableMangas, Math.min(count, availableMangas.length))
      
      res.json({
        archives: randomMangas.map(manga => ({
          arcid: manga.hash,
          title: manga.title,
          tags: formatTags(manga.tags)
        }))
      })
    } catch (error) {
      console.error('LAN browsing random error:', error)
      res.status(500).json({ error: error.message })
    }
  })

  // API: 获取漫画元数据
  LANBrowsing.get('/api/archives/:hash/metadata', async (req, res) => {
    try {
      const hash = req.params.hash
      mangas = await loadBookListFromDatabase()
      const manga = mangas.find(m => m.hash === hash)
      
      if (!manga) {
        return res.status(404).json({ error: 'Archive not found' })
      }

      res.json({
        arcid: manga.hash,
        title: manga.title,
        title_jpn: manga.title_jpn || '',
        tags: formatTags(manga.tags),
        pages: manga.pageCount || 0,
        category: manga.category || '',
        uploader: manga.uploader || '',
        rating: manga.rating || 0,
        posted: manga.posted || 0,
        filesize: manga.bundleSize || 0
      })
    } catch (error) {
      console.error('LAN browsing metadata error:', error)
      res.status(500).json({ error: error.message })
    }
  })

  // API: 获取缩略图
  LANBrowsing.get('/api/archives/:hash/thumbnail', async (req, res) => {
    try {
      const hash = req.params.hash
      mangas = await loadBookListFromDatabase()
      const manga = mangas.find(m => m.hash === hash)
      
      if (!manga || !manga.coverPath) {
        return res.status(404).json({ error: 'Thumbnail not found' })
      }

      res.sendFile(manga.coverPath)
    } catch (error) {
      console.error('LAN browsing thumbnail error:', error)
      res.status(500).json({ error: error.message })
    }
  })

  // API: 获取文件列表
  LANBrowsing.get('/api/archives/:hash/files', async (req, res) => {
    try {
      const hash = req.params.hash
      mangas = await loadBookListFromDatabase()
      const manga = mangas.find(m => m.hash === hash)
      
      if (!manga) {
        return res.status(404).json({ error: 'Archive not found' })
      }

      const fileList = await getBookFilelist(manga.filepath, manga.type)
      res.json({
        pages: fileList.map((file, index) => ({
          filename: file,
          page: index
        }))
      })
    } catch (error) {
      console.error('LAN browsing files error:', error)
      res.status(500).json({ error: error.message })
    }
  })

  // API: 获取页面图片
  LANBrowsing.get('/api/archives/:hash/page', async (req, res) => {
    try {
      const hash = req.params.hash
      const page = parseInt(req.query.page, 10) || 0
      
      mangas = await loadBookListFromDatabase()
      const manga = mangas.find(m => m.hash === hash)
      
      if (!manga) {
        return res.status(404).json({ error: 'Archive not found' })
      }

      const fileList = await getBookFilelist(manga.filepath, manga.type)
      if (page < 0 || page >= fileList.length) {
        return res.status(404).json({ error: 'Page not found' })
      }

      // 这里需要实际的图片读取逻辑
      // 暂时返回404
      res.status(404).json({ error: 'Not implemented' })
    } catch (error) {
      console.error('LAN browsing page error:', error)
      res.status(500).json({ error: error.message })
    }
  })

  // 阅读器页面
  LANBrowsing.get('/reader', async (req, res) => {
    res.send('<html><body><h1>Reader - Not implemented</h1></body></html>')
  })

  // 首页重定向到文档
  LANBrowsing.get('/', (req, res) => {
    const setting = dependencies.setting || {}
    switch (setting.language) {
      case 'en-US':
        res.redirect('https://github.com/SchneeHertz/exhentai-manga-manager/wiki/LAN-Browsing')
        break
      case 'zh-CN':
      case 'zh-TW':
      default:
        res.redirect('https://github.com/SchneeHertz/exhentai-manga-manager/wiki/%E5%B1%80%E5%9F%9F%E7%BD%91%E6%B5%8F%E8%A7%88')
        break
    }
  })

  let LANBrowsingInstance

  // 启动服务器
  const startLANBrowsingServer = (retryPort = port) => {
    try {
      LANBrowsingInstance = LANBrowsing.listen(retryPort, '0.0.0.0', () => {
        sendMessageToWebContents(`LAN browsing listening at http://0.0.0.0:${retryPort}`)
      }).on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.log(`Port ${retryPort} is already in use, trying port ${retryPort + 1}`)
          startLANBrowsingServer(retryPort + 1)
        } else {
          console.error('LAN browsing server error:', err)
          sendMessageToWebContents(`LAN browsing failed to start: ${err.message}`)
        }
      })
    } catch (err) {
      console.error('Failed to start LAN browsing server:', err)
      sendMessageToWebContents(`LAN browsing failed to start: ${err.message}`)
    }
  }

  // 启用LAN浏览
  const enableLANBrowsing = () => {
    if (LANBrowsingInstance?.listening) {
      LANBrowsingInstance.close(() => {
        startLANBrowsingServer()
      })
    } else {
      startLANBrowsingServer()
    }
  }

  return {
    enableLANBrowsing,
    LANBrowsingInstance
  }
}

module.exports = {
  initLANBrowsing,
  LANBrowsing
}


