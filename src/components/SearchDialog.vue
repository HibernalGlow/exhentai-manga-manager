<template>
  <SearchDialogBrowser ref="browserRef"
                       v-model:visible="dialogVisibleEhSearch"
                       @confirm="onConfirm"
                       @confirmPartialUpdate="onConfirmPartialUpdate"
  />
</template>
<script setup lang="ts">
/** The following contains functions to parse metadata from various online sources and batch get metadata function
 *  It also opens the sub browser window for searching books manually via `openSearchDialog`
 *  Browser configurations are in SearchDialogBrowser.vue
 *  The child component handles the dialog display
 *  The variable `dialogVisibleEhSearch` is two-way proxy computed with the child component's `visible` prop
 * */

import {nextTick, ref} from 'vue'
import {useI18n} from 'vue-i18n'
import {ElMessage} from 'element-plus'

import he from 'he'
import SearchDialogBrowser from './SearchDialogBrowser.vue'
import {fetchNhentaiMeta, fetchNhentaiPartialMeta} from '../scrapers/nhentai'
import {fetchEhExPartialMeta} from '../scrapers/exeh'
import {storeToRefs} from 'pinia'
import {useAppStore} from '../pinia.js'

const appStore = useAppStore()
const {
  categoryOption,
  setting, bookList, serviceAvailable,
  cookie, tag2cat
} = storeToRefs(appStore)
const {printMessage, returnTrimFileName, saveBook} = appStore

const {t} = useI18n()
// const emit = defineEmits<{ (e: 'confirm', payload: { bookDetail, url: string }): void }>()

const dialogVisibleEhSearch = ref(false)
const searchResultLoading = ref(false)
const ehSearchResultList = ref([])
const browserRef = ref<typeof SearchDialogBrowser>(null)

async function openSearchDialog(book) {
  dialogVisibleEhSearch.value = true
  await nextTick()
  const api = browserRef.value
  if (!api?.openSearchDialogBrowser) {
    console.warn('SearchDialogBrowser API not available (ref missing or method not exposed).')
  }
  await api.openSearchDialogBrowser(book)
}

const resolveSearchResult = (bookId, url, type) => {
  const book = _.find(bookList.value, {id: bookId})
  if (type === 'hentag') {
    book.url = url
    getBookInfoFromHentag(book)
  } else if (type === 'e-hentai') {
    book.url = url
    getBookInfoFromEh(book)
  } else if (type === 'nhentai') {
    book.url = url
    getBookInfoFromNH(book)
  }
  dialogVisibleEhSearch.value = false
}

const getBookInfo = (book) => {
  console.log('[Batch Metadata] 🔄 开始获取书籍元数据')
  console.log('[Batch Metadata] 📖 书籍ID:', book.id)
  console.log('[Batch Metadata] 🔗 URL:', book.url)

  if (!book.url) {
    console.warn('[Batch Metadata] ⚠️ 书籍没有URL，跳过元数据获取')
    return
  }

  // 根据URL类型调用相应的获取方法
  if (book.url.includes('hentag.com')) {
    console.log('[Batch Metadata] 🎯 检测到Hentag URL')
    getBookInfoFromHentag(book)
  } else if (book.url.includes('exhentai.org') || book.url.includes('e-hentai.org')) {
    console.log('[Batch Metadata] 🎯 检测到E-Hentai/ExHentai URL')
    getBookInfoFromEh(book)
  } else if (book.url.includes('nhentai.net')) {
    console.log('[Batch Metadata] 🎯 检测到Nhentai URL')
    getBookInfoFromNH(book)
  } else {
    console.warn('[Batch Metadata] ⚠️ 未知的URL类型:', book.url)
  }
}
const getBookInfoFromHentag = async (book) => {
  const data = await fetch(`https://hentag.com/public/api/vault/${book.url.slice(25)}`).then(res => res.json())
  const tags = {}
  data.language === 11 ? tags['language'] = ['chinese', 'translated'] : ''
  data.parodies.length > 0 ? tags['parody'] = data.parodies.map(parody => parody.name) : ''
  data.characters.length > 0 ? tags['character'] = data.characters.map(character => character.name) : ''
  data.circles.length > 0 ? tags['group'] = data.circles.map(circle => circle.name) : ''
  data.artists.length > 0 ? tags['artist'] = data.artists.map(artist => artist.name) : ''
  data.maleTags.length > 0 ? tags['male'] = data.maleTags.map(maleTag => maleTag.name) : ''
  data.femaleTags.length > 0 ? tags['female'] = data.femaleTags.map(femaleTag => femaleTag.name) : ''
  if (data.otherTags.length > 0) {
    data.otherTags.forEach(({name}) => {
      const cat = tag2cat.value[name]
      if (cat) {
        if (tags[cat]) {
          tags[cat].push(name)
        } else {
          tags[cat] = [name]
        }
      } else {
        if (tags['misc']) {
          tags['misc'].push(name)
        } else {
          tags['misc'] = [name]
        }
      }
    })
  }
  _.assign(book, {
    title: data.title,
    posted: Math.floor(data.createdAt / 1000),
    // doujinshi category value is 1
    category: categoryOption.value[data.category - 1],
    tags
  })
  book.status = 'tagged'
  await saveBook(book)
}

const getBookInfoFromEh = async (book) => {
  const match = /(\d+)\/([a-z0-9]+)/.exec(book.url)
  const res = await ipcRenderer.invoke('post-data-ex', {
    url: 'https://api.e-hentai.org/api.php',
    data: {
      'method': 'gdata',
      'gidlist': [
        [+match[1], match[2]]
      ],
      'namespace': 1
    }
  })
  try {
    _.assign(
        book,
        _.pick(JSON.parse(res).gmetadata[0], ['tags', 'title', 'title_jpn', 'filecount', 'rating', 'posted', 'filesize', 'category']),
    )
    book.posted = +book.posted
    book.filecount = +book.filecount
    book.rating = +book.rating
    book.title = he.decode(book.title)
    book.title_jpn = he.decode(book.title_jpn)
    const tagObject = _.groupBy(book.tags, tag => {
      const result = /(.+):/.exec(tag)
      if (result) {
        return /(.+):/.exec(tag)[1]
      } else {
        return 'misc'
      }
    })
    _.forIn(tagObject, (arr, key) => {
      tagObject[key] = arr.map(tag => {
        const result = /:(.+)$/.exec(tag)
        if (result) {
          return /:(.+)$/.exec(tag)[1]
        } else {
          return tag
        }
      })
    })
    book.tags = tagObject
    book.status = 'tagged'

    await saveBook(book)
  } catch (e) {
    console.log(e)
    if (_.includes(res, 'Your IP address has been')) {
      book.status = 'non-tag'
      printMessage('error', t('c.ipBanned'))
      await saveBook(book)
      serviceAvailable.value = false
    } else {
      book.status = 'tag-failed'
      printMessage('error', t('c.getMetadataFailed'))
      await saveBook(book)
    }
  }
}

const getBookInfoFromNH = async (book) => {
  console.log('[NH Meta] Fetching metadata for:', book.url)
  try {
    const meta = await fetchNhentaiMeta(book.url)
    console.log('[NH Meta] Received metadata:', {
      title: meta.title,
      title_jpn: meta.title_jpn,
      category: meta.category,
      pages: meta.pages,
      tagKeys: Object.keys(meta.tags),
      tagCounts: Object.entries(meta.tags).map(([k, v]) => `${k}:${v.length}`).join(', ')
    })
    
    _.assign(book, {
      title: meta.title,
      title_jpn: meta.title_jpn,
      tags: meta.tags,
      category: meta.category,
      filecount: meta.pages,
    })
    book.status = 'tagged'
    await saveBook(book)
    console.log('[NH Meta] Successfully saved book with tags')
    printMessage('success', t('c.getMetadataSuccess'))
  } catch (e) {
    console.error('[NH Meta] Failed to fetch nhentai metadata:', e)
    console.error('[NH Meta] Error details:', {
      name: e.name,
      message: e.message,
      stack: e.stack
    })
    book.status = 'tag-failed'
    printMessage('error', t('c.getMetadataFailed'))
    await saveBook(book)
  }
}

// use in the main window to batch get metadata
const getBooksMetadata = async (bookList, gap, callback) => {
  const server = setting.value.defaultScraper || 'exhentai'
  console.log('[Batch Metadata] ===== 开始批量获取元数据 =====')
  console.log('[Batch Metadata] 总书籍数量:', bookList.length)
  console.log('[Batch Metadata] 使用服务器:', server)
  console.log('[Batch Metadata] 请求间隔:', gap, 'ms')

  serviceAvailable.value = true
  const timer = ms => new Promise(res => setTimeout(res, ms))
  const messageInstance = ElMessage({
    message: t('c.gettingMetadata'),
    type: 'success',
    duration: 0,
    showClose: true,
    onClose: () => {
      serviceAvailable.value = false
    }
  })

  let successCount = 0
  let failedCount = 0
  let skippedCount = 0
  let startTime = Date.now()

  // 收集所有搜索结果的JSON数据
  const allSearchResults = []

  for (let i = 0; i < bookList.length; i++) {
    ipcRenderer.invoke('set-progress-bar', (i + 1) / bookList.length)
    const book = bookList[i]

    console.log(`[Batch Metadata] --- 处理书籍 ${i + 1}/${bookList.length} ---`)
    console.log(`[Batch Metadata] 书籍ID: ${book.id}`)
    console.log(`[Batch Metadata] 文件路径: ${book.filepath}`)
    console.log(`[Batch Metadata] 当前状态: ${book.status}`)
    console.log(`[Batch Metadata] 是否有URL: ${!!book.url}`)
    console.log(`[Batch Metadata] 是否有Hash: ${!!book.hash}`)

    try {
      if (serviceAvailable.value) {
        if (!book.url) {
          console.log('[Batch Metadata] 📋 无URL，开始搜索标题')
          const searchTitle = returnTrimFileName(book)
          console.log('[Batch Metadata] 🔍 搜索标题:', searchTitle)

          const resultList = await getBookListFromWeb(
              book.hash?.toUpperCase(),
              searchTitle,
              server,
              book.filepath
          )
          console.log('[Batch Metadata] 📊 搜索结果数量:', resultList.length)

          if (resultList.length > 0) {
            console.log('[Batch Metadata] ✅ 找到匹配结果')

            // 创建结构化的搜索结果JSON
            const searchResults = {
              bookId: book.id,
              bookTitle: book.title,
              searchTitle: searchTitle,
              bookHash: book.hash,
              server: server,
              totalResults: resultList.length,
              candidates: resultList.map((result, index) => ({
                index: index + 1,
                url: result.url,
                type: result.type,
                title: result.title || 'N/A',
                thumbnail: result.thumbnail || null,
                category: result.category || 'N/A',
                tags: result.tags || {},
                pages: result.pages || 0,
                posted: result.posted || null,
                rating: result.rating || null,
                uploader: result.uploader || null,
                // 计算相似度分数（基于标题匹配度）
                similarityScore: calculateSimilarityScore(searchTitle, result.title || '')
              })).sort((a, b) => b.similarityScore - a.similarityScore) // 按相似度降序排序
            }

            // 添加到结果集合中
            allSearchResults.push(searchResults)

            console.log('[Batch Metadata] 📋 已收集搜索结果到JSON流')
            console.log(`[Batch Metadata] 当前JSON流大小: ${allSearchResults.length}`)

            // 暂时使用相似度最高的结果（可以后续让AI选择）
            const bestMatch = searchResults.candidates[0]
            console.log('[Batch Metadata] 🎯 自动选择最佳匹配:')
            console.log(`  - 相似度: ${bestMatch.similarityScore.toFixed(2)}`)
            console.log(`  - URL: ${bestMatch.url}`)
            console.log(`  - 类型: ${bestMatch.type}`)
            console.log(`  - 标题: ${bestMatch.title}`)

            resolveSearchResult(book.id, bestMatch.url, bestMatch.type)
            successCount++
            console.log('[Batch Metadata] ✅ 解析搜索结果成功')
          } else {
            console.warn('[Batch Metadata] ❌ 未找到搜索结果')
            book.status = 'tag-failed'
            await saveBook(book)
            failedCount++
            console.log('[Batch Metadata] 💾 已保存为失败状态')
          }
        } else {
          console.log('[Batch Metadata] 📋 已有URL，直接获取元数据')
          console.log('[Batch Metadata] 🔗 URL:', book.url)
          getBookInfo(book)
          successCount++
          console.log('[Batch Metadata] ✅ 直接获取元数据完成')
        }

        console.log(`[Batch Metadata] ⏱️ 等待 ${gap}ms 后继续...`)
        await timer(gap)
      } else {
        console.log('[Batch Metadata] ⏸️ 服务不可用，跳过处理')
        skippedCount++
      }
    } catch (error) {
      console.error('[Batch Metadata] ❌ 处理书籍时出错:', error)
      console.error('[Batch Metadata] 错误详情:', error.message)
      console.error('[Batch Metadata] 错误堆栈:', error.stack)
      book.status = 'tag-failed'
      await saveBook(book)
      failedCount++
      console.log('[Batch Metadata] 💾 已保存为失败状态')
    }

    console.log(`[Batch Metadata] --- 书籍 ${i + 1} 处理完成 ---\n`)
  }

  const endTime = Date.now()
  const duration = endTime - startTime

  console.log('[Batch Metadata] ===== 批量获取元数据完成 =====')
  console.log('[Batch Metadata] 📈 处理统计:')
  console.log(`  - 总数量: ${bookList.length}`)
  console.log(`  - 成功: ${successCount}`)
  console.log(`  - 失败: ${failedCount}`)
  console.log(`  - 跳过: ${skippedCount}`)
  console.log(`  - 总耗时: ${duration}ms`)
  console.log(`  - 平均耗时: ${bookList.length > 0 ? Math.round(duration / bookList.length) : 0}ms/本`)

  // 输出完整的JSON结果流
  if (allSearchResults.length > 0) {
    console.log('[Batch Metadata] 📋 ===== 完整搜索结果JSON流 =====')
    console.log(JSON.stringify({
      summary: {
        totalBooks: bookList.length,
        booksWithResults: allSearchResults.length,
        successCount: successCount,
        failedCount: failedCount,
        skippedCount: skippedCount,
        duration: duration,
        server: server
      },
      searchResults: allSearchResults
    }, null, 2))
    console.log('[Batch Metadata] 📋 ===== JSON流输出完成 =====')
  }

  messageInstance.close()
  ipcRenderer.invoke('set-progress-bar', -1)
  printMessage('success', t('c.getMetadataComplete'))
  callback?.()
}

const getBookListFromWeb = async (bookHash, title, server = 'e-hentai', bookPath = '') => {
  let resultList = []
  searchResultLoading.value = true
  if (server === 'e-hentai') {
    resultList = await fetch(`https://e-hentai.org/?f_shash=${bookHash}&fs_similar=on&fs_exp=on&f_cats=161`)
        .then(res => res.text())
        .then(res => {
          return resolveEhentaiResult(res)
        })
  } else if (server === 'exhentai') {
    resultList = await ipcRenderer.invoke('get-ex-webpage', {
      url: `https://exhentai.org/?f_shash=${bookHash}&fs_similar=on&fs_exp=on&f_cats=161`,
      cookie: cookie.value
    })
        .then(res => {
          return resolveEhentaiResult(res)
        })
  } else if (server === 'e-search') {
    resultList = await fetch(`https://e-hentai.org/?f_search=${encodeURI(title)}&f_cats=161`)
        .then(res => res.text())
        .then(res => {
          return resolveEhentaiResult(res)
        })
  } else if (server === 'exsearch') {
    resultList = await ipcRenderer.invoke('get-ex-webpage', {
      url: `https://exhentai.org/?f_search=${encodeURI(title)}&f_cats=161`,
      cookie: cookie.value
    })
        .then(res => {
          return resolveEhentaiResult(res)
        })
  } else if (server === 'hentag') {
    resultList = await fetch(`https://hentag.com/public/api/vault-search?t=${encodeURI(title)}`)
        .then(res => res.json())
        .then(res => {
          return resolveHentagResult(res)
        })
  } else if (server === 'nhentai') {
    const searchUrl = `https://nhentai.net/search/?q=${encodeURIComponent(title)}`
    console.log('[NH Search] Searching nhentai with URL:', searchUrl)
    console.log('[NH Search] Search title:', title)
    
    // Use get-ex-webpage instead of fetch to avoid CORS and 403 issues
    resultList = await ipcRenderer.invoke('get-ex-webpage', {
      url: searchUrl,
      cookie: '' // nhentai doesn't need cookies for search
    })
        .then(html => {
          console.log('[NH Search] Received HTML, length:', html?.length)
          if (!html) {
            console.error('[NH Search] Empty HTML response')
            return []
          }
          console.log('[NH Search] Parsing results...')
          return resolveNhentaiResult(html)
        })
    
    console.log('[NH Search] Final result list:', resultList.length, 'items')
  } else if (server === '.ehviewer') {
    const ehviewerData = await ipcRenderer.invoke('get-ehviewer-data', bookPath)

    ehSearchResultList.value = []
    if (ehviewerData) {
      resultList = [{
        title,
        url: `https://exhentai.org/g/${ehviewerData.gid}/${ehviewerData.token}/`,
        type: 'e-hentai'
      }]
      ehSearchResultList.value = resultList
    }
  }
  searchResultLoading.value = false
  return resultList
}


const resolveEhentaiResult = (htmlString) => {
  try {
    const resultNodes = new DOMParser().parseFromString(htmlString, 'text/html').querySelectorAll('.gl3c.glname')
    ehSearchResultList.value = []
    resultNodes.forEach((node) => {
      ehSearchResultList.value.push({
        title: node.querySelector('.glink').innerHTML,
        url: node.querySelector('a').getAttribute('href'),
        type: 'e-hentai'
      })
    })
    return ehSearchResultList.value
  } catch (e) {
    console.log(e)
    if (htmlString.includes('Your IP address has been')) {
      serviceAvailable.value = false
      printMessage('error', t('c.ipBanned'))
    } else {
      printMessage('error', t('c.getMetadataFailed'))
    }
  }
}

const resolveNhentaiResult = (htmlString) => {
  console.log('[NH Search] Parsing HTML, length:', htmlString.length)
  try {
    const doc = new DOMParser().parseFromString(htmlString, 'text/html')
    const resultNodes = doc.querySelectorAll('.gallery')
    console.log('[NH Search] Found gallery nodes:', resultNodes.length)
    
    ehSearchResultList.value = []
    
    resultNodes.forEach((node, index) => {
      const linkElement = node.querySelector('a.cover')
      const titleElement = node.querySelector('.caption')
      
      console.log(`[NH Search] Gallery ${index}:`, {
        hasLink: !!linkElement,
        hasTitle: !!titleElement
      })
      
      if (linkElement && titleElement) {
        const href = linkElement.getAttribute('href')
        const title = titleElement.textContent.trim()
        
        console.log(`[NH Search] Gallery ${index} data:`, { href, title })
        
        if (href && title) {
          ehSearchResultList.value.push({
            title: title,
            url: `https://nhentai.net${href}`,
            type: 'nhentai'
          })
        }
      }
    })
    
    console.log('[NH Search] Total results parsed:', ehSearchResultList.value.length)
    return ehSearchResultList.value
  } catch (e) {
    console.error('[NH Search] Failed to parse nhentai result:', e)
    printMessage('error', t('c.getMetadataFailed'))
    return []
  }
}

const resolveHentagResult = (data) => {
  const resultList = data.works.slice(0, 10)
  ehSearchResultList.value = []
  resultList.forEach((result) => {
    const findExUrl = result.locations.find((location) => location.startsWith('https://exhentai.org'))
    if (findExUrl) {
      ehSearchResultList.value.push({
        title: result.title,
        url: findExUrl,
        type: 'e-hentai'
      })
    } else {
      ehSearchResultList.value.push({
        title: result.title,
        url: `https://hentag.com/vault/${result.id}`,
        type: 'hentag'
      })
    }
  })
  return ehSearchResultList.value
}

async function onConfirm({bookDetail, url}) {
  const cleaned = (url ?? '').trim()
  if (!cleaned) return
  bookDetail.url = cleaned
  await saveBook(bookDetail)
  getBookInfo(bookDetail)
}

async function onConfirmPartialUpdate({bookDetail, url, wcId}) {
  // only update the artist/group/category/cosplayer tags
  try {
    let meta
    if (url.includes('exhentai') || url.includes('e-hentai')) {
      meta = await fetchEhExPartialMeta(url, wcId)
    } else if (url.includes('nhentai')) {
      meta = await fetchNhentaiPartialMeta(url, wcId)
    }
    
    if (meta) {
      _.assign(bookDetail, {
        tags: meta.tags,
        category: meta.category,
      })
      bookDetail.status = 'tagged'
      await saveBook(bookDetail)
      printMessage('success', t('c.getMetadataSuccess'))
    }
  } catch (e) {
    console.error('Failed to partial update metadata:', e)
    bookDetail.status = 'tag-failed'
    printMessage('error', t('c.getMetadataFailed'))
    await saveBook(bookDetail)
  } finally {
    dialogVisibleEhSearch.value = false
  }
}

function calculateSimilarityScore(searchTitle, resultTitle) {
  if (!searchTitle || !resultTitle) return 0

  const search = searchTitle.toLowerCase().trim()
  const result = resultTitle.toLowerCase().trim()

  // 完全匹配
  if (search === result) return 1.0

  // 包含关系
  if (result.includes(search) || search.includes(result)) return 0.8

  // 计算词重叠度
  const searchWords = search.split(/\s+/).filter(word => word.length > 1)
  const resultWords = result.split(/\s+/).filter(word => word.length > 1)

  if (searchWords.length === 0 || resultWords.length === 0) return 0

  let matchCount = 0
  for (const word of searchWords) {
    if (resultWords.some(rWord => rWord.includes(word) || word.includes(rWord))) {
      matchCount++
    }
  }

  const overlapRatio = matchCount / Math.max(searchWords.length, resultWords.length)
  return Math.min(overlapRatio * 0.6, 0.6) // 最高0.6，避免与完全匹配冲突
}

defineExpose({
  dialogVisibleEhSearch,
  openSearchDialog,
  getBookInfo,
  getBooksMetadata,
})

</script>

<style lang="stylus">
.dialog-search
  .el-form-item
    margin-right: 4px

  .search-input
    width: calc(60vw - 152px)

</style>