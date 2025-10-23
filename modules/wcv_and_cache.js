/**
 * WebContentsView (WCV) 和缓存管理模块
 * 包含wcv相关的IPC处理器和缓存相关的辅助函数（约525行）
 */

const { ipcMain, BrowserWindow, WebContentsView } = require('electron')
const path = require('path')
const fs = require('fs')
const fsp = fs.promises
const zlib = require('zlib')
const { createHash } = require('crypto')
const { unpack, pack } = require('msgpackr')

// 缓存格式常量
const MAGIC = Buffer.from('EMMC0001', 'utf8')
const HEADER_SIZE = 72

/**
 * 初始化WCV和缓存功能
 */
function initWCVAndCache(dependencies) {
  const {
    Manga,
    Metadata,
    STORE_PATH
  } = dependencies

  // Track WebContentsView instances by id
  const wcvById = new Map()

  function resolveHostWindow(sender) {
    const bySender = BrowserWindow.fromWebContents(sender)
    if (bySender) return bySender
    return BrowserWindow.getFocusedWindow() || null
  }

  function ensureView(host, id, opts) {
    const existing = wcvById.get(id)
    if (existing && existing.view && !existing.view.webContents.isDestroyed()) {
      if (existing.host !== host) {
        try { existing.host.contentView.removeChildView(existing.view) } catch {}
        host.contentView.addChildView(existing.view)
        existing.host = host
      }
      return existing.view
    }

    const view = new WebContentsView({
      webPreferences: {
        partition: opts.partition || 'persist:search',
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })

    if (opts.userAgent) {
      view.webContents.setUserAgent(opts.userAgent)
    }

    host.contentView.addChildView(view)
    wcvById.set(id, { view, host })

    return view
  }

  function pushNavState(rec) {
    if (!rec || !rec.view || rec.view.webContents.isDestroyed()) return
    const wc = rec.view.webContents
    const nh = wc.navigationHistory
    rec.host.webContents.send('wcv:nav-state', {
      id: Array.from(wcvById.entries()).find(([_, r]) => r === rec)?.[0],
      canGoBack: nh?.canGoBack?.() ?? wc.canGoBack?.() ?? false,
      canGoForward: nh?.canGoForward?.() ?? wc.canGoForward?.() ?? false,
      url: wc.getURL()
    })
  }

  // ==================== WCV IPC处理器 ====================

  ipcMain.handle('wcv:attach', async (evt, payload) => {
    const host = resolveHostWindow(evt.sender)
    if (!host) return { ok: false, reason: 'no-host' }

    const { id, bounds, partition, userAgent, url } = payload
    const view = ensureView(host, id, { partition, userAgent })
    view.setBounds(bounds)

    if (url) {
      await view.webContents.loadURL(url)
    }

    view.webContents.on('did-navigate', () => pushNavState(wcvById.get(id)))
    view.webContents.on('did-navigate-in-page', () => pushNavState(wcvById.get(id)))

    pushNavState(wcvById.get(id))
    return { ok: true }
  })

  ipcMain.handle('wcv:set-bounds', (_evt, payload) => {
    const { id, bounds } = payload
    const rec = wcvById.get(id)
    if (!rec) return { ok: false, reason: 'not-found' }
    rec.view.setBounds(bounds)
    return { ok: true }
  })

  ipcMain.handle('wcv:loadURL', async (_evt, payload) => {
    const { id, url } = payload
    const rec = wcvById.get(id)
    if (!rec) return { ok: false, reason: 'not-found' }
    await rec.view.webContents.loadURL(url)
    return { ok: true }
  })

  ipcMain.handle('wcv:detach', (_evt, id) => {
    const rec = wcvById.get(id)
    if (!rec) return { ok: false, reason: 'not-found' }
    try { rec.host.contentView.removeChildView(rec.view) } catch {}
    wcvById.delete(id)
    return { ok: true }
  })

  ipcMain.handle('wcv:getState', (_e, id) => {
    const rec = wcvById.get(id)
    if (!rec) return null
    const wc = rec.view.webContents
    const nh = wc.navigationHistory
    return {
      canGoBack: nh?.canGoBack?.() ?? wc.canGoBack?.() ?? false,
      canGoForward: nh?.canGoForward?.() ?? wc.canGoForward?.() ?? false,
      url: wc.getURL()
    }
  })

  ipcMain.handle('wcv:nav', (_e, { id, dir }) => {
    const rec = wcvById.get(id)
    if (!rec) return { ok: false, reason: 'not-found' }
    const wc = rec.view.webContents
    const nh = wc.navigationHistory
    try {
      if (dir === 'back') (nh?.canGoBack?.() ? nh.goBack() : wc.goBack?.())
      if (dir === 'forward') (nh?.canGoForward?.() ? nh.goForward() : wc.goForward?.())
    } catch (e) {
      return { ok: false, error: String(e) }
    }
    pushNavState(rec)
    return { ok: true }
  })

  // searchSessionFetchUrl - 使用CDP获取网页内容
  ipcMain.handle("searchSessionFetchUrl", async (_e, { url, wcId }) => {
    const rec = wcvById.get(wcId)
    if (!rec) throw new Error(`view not found for wcId=${wcId}`)
    const wc = rec.view.webContents

    const target = url.trim()
    const sameUrl = wc.getURL() === target

    const dbg = wc.debugger
    let attachedHere = false

    try {
      if (!dbg.isAttached()) {
        dbg.attach("1.3")
        attachedHere = true
      }
      await dbg.sendCommand("Network.enable")

      let docRequestId = null

      const onMessage = (event, method, params) => {
        if (method === "Network.requestWillBeSent") {
          if (params.type === "Document") {
            const reqUrl = params.request?.url || params.documentURL
            if (!target || reqUrl === target || sameUrl) {
              docRequestId = params.requestId
            }
          }
        }
      }

      dbg.on("message", onMessage)

      if (!sameUrl) {
        await wc.loadURL(target)
      } else {
        wc.reload()
      }

      await new Promise((resolve) => setTimeout(resolve, 1000))

      if (!docRequestId) {
        throw new Error("No document request found")
      }

      const resp = await dbg.sendCommand("Network.getResponseBody", {
        requestId: docRequestId
      })

      dbg.off("message", onMessage)
      if (attachedHere) {
        dbg.detach()
      }

      return {
        body: resp.body,
        base64Encoded: resp.base64Encoded || false
      }
    } catch (error) {
      if (attachedHere && dbg.isAttached()) {
        try {
          dbg.detach()
        } catch {}
      }
      throw error
    }
  })

  // ==================== 缓存相关处理器 ====================

  const cacheFilePath = path.join(STORE_PATH, 'app-cache.bin')

  ipcMain.handle("load-cache", async (_e, opts = {}) => {
    try {
      const buf = await fsp.readFile(cacheFilePath)
      const hdr = verifyHeaderAndChecksum(buf)

      if (
        opts.expectFormatVersion != null &&
        hdr.version !== opts.expectFormatVersion
      ) {
        throw new Error(
          `Cache format mismatch: got ${hdr.version}, need ${opts.expectFormatVersion}`
        )
      }

      const raw = zlib.brotliDecompressSync(buf.subarray(HEADER_SIZE))

      if (hdr.uncompressedSize && hdr.uncompressedSize !== raw.length) {
        throw new Error(`Cache version mismatch`)
      }

      const container = unpack(raw)
      if (!container || typeof container !== 'object' || !container.meta) {
        throw new Error('Cache payload missing meta')
      }

      return {
        meta: container.meta,
        appCache: container.data,
        dbSignature: container.dbSignature
      }
    } catch (error) {
      console.error('Load cache error:', error)
      return null
    }
  })

  ipcMain.handle("should-use-cache", async (_e, dbSig) => {
    if (!dbSig) return false
    const MangaDbSig = await readDbSignatureSequelize(Manga.sequelize)
    const MetadataDbSig = await readDbSignatureSequelize(Metadata.sequelize)
    return signaturesMatch(dbSig.MangaDbSig, MangaDbSig) &&
           signaturesMatch(dbSig.MetadataDbSig, MetadataDbSig)
  })

  let latestAppCache = null
  ipcMain.on('cache:update', (_e, appCache) => {
    latestAppCache = appCache
  })

  // ==================== 缓存辅助函数 ====================

  async function readDbSignatureSequelize(sequelize) {
    const [revRow] = await sequelize.query(
      "SELECT CAST(value AS INTEGER) AS rev FROM meta WHERE key='rev' LIMIT 1;",
      { type: sequelize.QueryTypes.SELECT }
    )
    const [sv] = await sequelize.query("PRAGMA schema_version;", {
      type: sequelize.QueryTypes.SELECT
    })
    const [uv] = await sequelize.query("PRAGMA user_version;", {
      type: sequelize.QueryTypes.SELECT
    })

    return {
      rev: Number(revRow?.rev || 0),
      schema_version: Number(sv?.schema_version || 0),
      user_version: Number(uv?.user_version || 0)
    }
  }

  function signaturesMatch(a, b) {
    if (!a || !b) return false
    return a.rev === b.rev &&
           a.schema_version === b.schema_version &&
           a.user_version === b.user_version
  }

  function u64ToBufLE(n) {
    const b = Buffer.allocUnsafe(8)
    let lo = n >>> 0
    let hi = Math.floor(n / 2 ** 32) >>> 0
    b.writeUInt32LE(lo, 0)
    b.writeUInt32LE(hi, 4)
    return b
  }

  function bufToU64LE(b, off) {
    const lo = b.readUInt32LE(off)
    const hi = b.readUInt32LE(off + 4)
    return hi * 2 ** 32 + lo
  }

  async function atomicWrite(filePath, data) {
    const dir = path.dirname(filePath)
    const tmp = path.join(dir, `${path.basename(filePath)}.tmp`)
    await fsp.mkdir(dir, { recursive: true })
    const fh = await fsp.open(tmp, 'w')
    try {
      await fh.writeFile(data)
      await fh.sync()
    } finally {
      await fh.close()
    }
    try {
      const dh = await fsp.opendir(dir)
      await fsp.stat(dir)
      await dh.close()
    } catch {}
    await fsp.rename(tmp, filePath)
  }

  function buildHeader({ version, createdAtMs, uncompressedSize, compressedPayload }) {
    const header = Buffer.alloc(HEADER_SIZE)
    MAGIC.copy(header, 0)
    header.writeUInt32LE(version >>> 0, 8)
    header.writeUInt32LE(0, 12)
    u64ToBufLE(createdAtMs).copy(header, 16)
    u64ToBufLE(uncompressedSize).copy(header, 24)
    u64ToBufLE(compressedPayload.length).copy(header, 32)
    const sha = createHash('sha256').update(compressedPayload).digest()
    sha.copy(header, 40)
    return header
  }

  function verifyHeaderAndChecksum(buf) {
    if (buf.length < HEADER_SIZE) throw new Error('Cache header too small')
    const header = buf.subarray(0, HEADER_SIZE)
    if (!header.subarray(0, 8).equals(MAGIC)) throw new Error('Bad cache magic')
    const version = header.readUInt32LE(8)
    const flags = header.readUInt32LE(12)
    const createdAtMs = bufToU64LE(header, 16)
    const uncompressedSize = bufToU64LE(header, 24)
    const compressedSize = bufToU64LE(header, 32)
    const shaExpected = header.subarray(40, 72)

    if (buf.length !== HEADER_SIZE + compressedSize) {
      throw new Error('Cache truncated/extra bytes')
    }

    const payload = buf.subarray(HEADER_SIZE)
    const shaActual = createHash('sha256').update(payload).digest()
    if (!shaActual.equals(shaExpected)) {
      throw new Error('Cache checksum mismatch')
    }

    return { version, flags, createdAtMs, uncompressedSize, compressedSize }
  }

  // 保存缓存（在应用退出前调用）
  async function saveCache(appCache, meta = {}) {
    try {
      const MangaDbSig = await readDbSignatureSequelize(Manga.sequelize)
      const MetadataDbSig = await readDbSignatureSequelize(Metadata.sequelize)

      const container = {
        meta,
        data: appCache,
        dbSignature: { MangaDbSig, MetadataDbSig }
      }

      const raw = pack(container)
      const compressed = zlib.brotliCompressSync(raw, {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: 6
        }
      })

      const header = buildHeader({
        version: 1,
        createdAtMs: Date.now(),
        uncompressedSize: raw.length,
        compressedPayload: compressed
      })

      const final = Buffer.concat([header, compressed])
      await atomicWrite(cacheFilePath, final)
      console.log('Cache saved successfully')
    } catch (error) {
      console.error('Save cache error:', error)
    }
  }

  return {
    wcvById,
    saveCache,
    latestAppCache: () => latestAppCache
  }
}

module.exports = {
  initWCVAndCache
}


