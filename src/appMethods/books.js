export async function loadCache() {
  const { appCache, dbSignature } = await ipcRenderer.invoke('load-app-cache')
  if (await ipcRenderer.invoke('should-use-cache', dbSignature)) {
    const bookHashes = appCache.bookList.map(book => book.hash || book.id)
    const translations = await ipcRenderer.invoke('get-translations-batch', bookHashes)
    for (const book of appCache.bookList) {
      const bookHash = book.hash || book.id
      if (translations[bookHash]) {
        book._translation = translations[bookHash]
      }
    }
    this.bookList = appCache.bookList
    this.$refs.FolderTreeRef.loadTreeCache(appCache.treeCache)
    this.$refs.EditViewRef.selectBookList = []
    this.handleSortChange(this.sortValue, this.bookList)
    this.recalculateCollectTagMatchCache()
    this.buildDuplicateCountCache()
    console.log('cached loaded')
  } else {
    throw new Error('Database changed, skip cache')
  }
}

export async function loadBookList(scan) {
  try {
    this.buttonLoadBookListLoading = true
    const res = await ipcRenderer.invoke('load-book-list', scan)
    for (const book of res) {
      if (book && typeof book.tags === 'string') {
        try {
          book.tags = JSON.parse(book.tags || '{}');
        } catch (e) {
          console.error(`[App.vue] Failed to parse tags for book ${book.id}:`, e);
          book.tags = {};
        }
      }
    }
    const bookHashes = res.map(book => book.hash || book.id)
    const translations = await ipcRenderer.invoke('get-translations-batch', bookHashes)
    for (const book of res) {
      const bookHash = book.hash || book.id
      if (translations[bookHash]) {
        book._translation = translations[bookHash]
      }
    }
    this.bookList = this.prepareBookList(res)
    if (this.bookDetail?.id) {
      const updatedBook = this.bookList.find(b => b.id === this.bookDetail.id);
      if (updatedBook) {
        this.bookDetail = updatedBook;
      }
    }
    this.$refs.FolderTreeRef.geneFolderTree(this.tagListRaw)
    this.loadCollectionList()
    this.$refs.EditViewRef.selectBookList = []
    this.buttonLoadBookListLoading = false
  } catch (error) {
    this.buttonLoadBookListLoading = false
    console.error(error)
  }
  if (scan) this.printMessage('success', this.$t('c.scanComplete'))
}

export function prepareBookList(bookList) {
  bookList.forEach(book => {
    if (Number.isInteger(book.filecount) && Number.isInteger(book.pageCount) && Math.abs(book.filecount - book.pageCount) > 5) book.pageDiff = true
  })
  return bookList
}

export async function loadCollectionList() {
  const raw = await ipcRenderer.invoke('load-collection-list')
  this.collectionList = Array.isArray(raw) ? raw : []
  _.forEach(this.collectionList, collection => {
    let collectBook = _.compact(collection.list.map(hash_id => {
      return _.filter(this.bookList, book => book.id === hash_id || book.hash === hash_id)
    }))
    collectBook = _.flatten(collectBook)
    collection.list = [...new Set(collectBook.map(book => book.hash))]
    collectBook.map(book => book.collectionHide = true)
    const date = _.last(_.compact(_.sortBy(collectBook.map(book => book.date))))
    const posted = _.last(_.compact(_.sortBy(collectBook.map(book => book.posted))))
    const rating = _.last(_.compact(_.sortBy(collectBook.map(book => book.rating))))
    const mtime = _.last(_.compact(_.sortBy(collectBook.map(book => book.mtime))))
    const mark = _.some(collectBook, 'mark')
    const pageDiff = _.some(collectBook, 'pageDiff') ? true : undefined
    const readCount = _.max(collectBook.map(book => book.readCount))
    const pageCount = _.sum(collectBook.map(book => book.pageCount))
    const tags = _.mergeWith({}, ...collectBook.map(book => book.tags), (obj, src) => {
      if (_.isArray(obj) && _.isArray(src)) {
        return [...new Set(obj.concat(src))]
      } else {
        return src
      }
    })
    const ids = collectBook.map(book => book.id)
    const title_jpn = collectBook.map(book => book.title + book.title_jpn).join(',')
    const filepath = collectBook.map(book => book.filepath).join(',')
    const category = [...new Set(collectBook.map(book => book.category))].join(',')
    const status = [...new Set(collectBook.map(book => book.status))].join(',')
    if (!_.isEmpty(collectBook)) {
      this.bookList.push({
        title: collection.title,
        id: collection.id,
        coverPath: collectBook?.[0]?.coverPath,
        date, posted, rating, mtime, mark, tags, title_jpn, category, status, pageDiff, readCount, pageCount,
        list: collection.list,
        filepath,
        isCollection: true,
        chapterCount: collection?.list?.length,
        ids,
      })
    }
  })
  this.handleSortChange(this.sortValue, this.bookList)
}

export function openCollection(collection) {
  this.drawerVisibleCollection = true
  const collectionSafe = Array.isArray(collection?.list) ? collection.list : []
  this.openCollectionBookList = _.compact(_.flatten(collectionSafe.list.map(hash_id => {
    return _.filter(this.bookList, book => book.id === hash_id || book.hash === hash_id)
  })))
  this.openCollectionTitle = collection.title
  this.$refs.EditViewRef.selectCollection = collection.id
}

export function editCurrentCollection() {
  this.drawerVisibleCollection = false
  this.$refs.EditViewRef.editCollectionView = true
  this.$refs.EditViewRef.handleSelectCollectionChange(this.$refs.EditViewRef.selectCollection)
}

export function handleRemoveBookDisplay() {
  this.chunkDisplayBookList = this.customChunk(this.displayBookList, this.setting.pageSize, this.currentPage - 1)
}

export function customChunk(list, size, index) {
  const result = []
  let count = 0
  let countIndex = 0
  _.forEach(list, (book) => {
    if (countIndex === index) result.push(book)
    if (this.isVisibleBook(book)) count++
    if (count >= size) {
      countIndex++
      count = 0
    }
    if (countIndex > index) return false
  })
  return result
}

export function chunkList() {
  this.currentPage = 1
  this.chunkDisplayBookList = this.customChunk(this.displayBookList, this.setting.pageSize, 0)
  this.scrollMainPageTop()
}


