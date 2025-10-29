import { filterBooksBySQL, sortByUrlGroup, isDuplicateGallery } from '../../modules/sqlFilter.js'
import { fetchRecentReads } from '../utils.js'

export function handleSortChange(val, bookList) {
  if (!bookList) bookList = this.displayBookList

  const sqlSupportedFilters = ['mark', 'hidden', 'notag', 'nocategory', 'duplicateGallery']

  if (sqlSupportedFilters.includes(val)) {
    this.filterBooksBySQLWrapper(val, bookList).then(filteredBooks => {
      this.displayBookList = filteredBooks
      this.chunkList()
    }).catch(error => {
      console.error('SQL筛选失败:', error)
      this.handleSortChangeFallback(val, bookList)
    })
    return
  }

  this.handleSortChangeFallback(val, bookList)
}

export function handleSortChangeFallback(val, bookList) {
  switch (val) {
    case 'mark':
      this.displayBookList = _.filter(this.bookList, 'mark')
      this.chunkList()
      break
    case 'collection':
      this.displayBookList = _.filter(this.bookList, 'isCollection')
      this.chunkList()
      break
    case 'hidden':
      this.displayBookList = _.filter(this.bookList, 'hiddenBook')
      this.chunkList()
      break
    case 'notag':
      this.displayBookList = _.filter(this.bookList, this.isNoTag)
      this.chunkList()
      break
    case 'nocategory':
      this.displayBookList = _.filter(this.bookList, this.isNoCategory)
      this.chunkList()
      break
    case 'duplicateGallery':
      this.displayBookList = _.filter(this.bookList, this.isDuplicateGallery)
      this.chunkList()
      break
    case 'recentRead':
      const recentReads = fetchRecentReads()
      this.displayBookList = _.uniqBy(
          recentReads.map(id => this.bookList.find(book => {
            if (book.collectionHide) return false
            if (book.isCollection) return book.ids.includes(id)
            return book.id === id
          }))
              .filter(book => book !== undefined),
          'id'
      )
    case 'shuffle':
      this.displayBookList = _.shuffle(bookList)
      this.chunkList()
      break
    case 'urlGroupAscend':
      this.displayBookList = sortByUrlGroup(bookList, true)
      this.chunkList()
      break
    case 'urlGroupDescend':
      this.displayBookList = sortByUrlGroup(bookList, false)
      this.chunkList()
      break
    case 'addAscend':
      this.displayBookList = bookList.toSorted(this.sortList('date')).toReversed()
      this.chunkList()
      break
    case 'addDescend':
      this.displayBookList = bookList.toSorted(this.sortList('date'))
      this.chunkList()
      break
    case 'mtimeAscend':
      this.displayBookList = bookList.toSorted(this.sortList('mtime')).toReversed()
      this.chunkList()
      break
    case 'mtimeDescend':
      this.displayBookList = bookList.toSorted(this.sortList('mtime'))
      this.chunkList()
      break
    case 'postAscend':
      this.displayBookList = bookList.toSorted(this.sortList('posted')).toReversed()
      this.chunkList()
      break
    case 'postDescend':
      this.displayBookList = bookList.toSorted(this.sortList('posted'))
      this.chunkList()
      break
    case 'scoreAscend':
      this.displayBookList = bookList.toSorted(this.sortList('rating')).toReversed()
      this.chunkList()
      break
    case 'scoreDescend':
      this.displayBookList = bookList.toSorted(this.sortList('rating'))
      this.chunkList()
      break
    case 'readCountAscend':
      this.displayBookList = bookList.toSorted(this.sortList('readCount')).toReversed()
      this.chunkList()
      break
    case 'readCountDescend':
      this.displayBookList = bookList.toSorted(this.sortList('readCount'))
      this.chunkList()
      break
    case 'artistAscend':
      this.displayBookList = bookList.toSorted(this.sortList('tags.artist')).toReversed()
      this.chunkList()
      break
    case 'artistDescend':
      this.displayBookList = bookList.toSorted(this.sortList('tags.artist'))
      this.chunkList()
      break
    case 'titleAscend':
      this.displayBookList = bookList.toSorted((a, b) => this.getDisplayTitle(b).localeCompare(this.getDisplayTitle(a), undefined, {
        numeric: true,
        sensitivity: 'base'
      })).toReversed()
      this.chunkList()
      break
    case 'titleDescend':
      this.displayBookList = bookList.toSorted((a, b) => this.getDisplayTitle(b).localeCompare(this.getDisplayTitle(a), undefined, {
        numeric: true,
        sensitivity: 'base'
      }))
      this.chunkList()
      break
    case 'pageAscend':
      this.displayBookList = bookList.toSorted(this.sortList('pageCount')).toReversed()
      this.chunkList()
      break
    case 'pageDescend':
      this.displayBookList = bookList.toSorted(this.sortList('pageCount'))
      this.chunkList()
      break
    case 'collectTagCountAscend':
      this.displayBookList = bookList.toSorted((a, b) => this.getCollectTagMatchCount(a) - this.getCollectTagMatchCount(b))
      this.chunkList()
      break
    case 'collectTagCountDescend':
      this.displayBookList = bookList.toSorted((a, b) => this.getCollectTagMatchCount(b) - this.getCollectTagMatchCount(a))
      this.chunkList()
      break
    case 'duplicateCountAscend':
      this.displayBookList = bookList.toSorted((a, b) => this.getDuplicateGalleryCount(a) - this.getDuplicateGalleryCount(b))
      this.chunkList()
      break
    case 'duplicateCountDescend':
      this.displayBookList = bookList.toSorted((a, b) => this.getDuplicateGalleryCount(b) - this.getDuplicateGalleryCount(a))
      this.chunkList()
      break
    default:
      this.displayBookList = this.bookList
      this.chunkList()
      break
  }
  localStorage.setItem('sortValue', val)
}

export function sortList(label) {
  return (a, b) => {
    if (_.get(a, label) && _.get(b, label)) {
      if (_.get(a, label) > _.get(b, label)) {
        return -1
      } else if (_.get(a, label) < _.get(b, label)) {
        return 1
      } else {
        return 0
      }
    } else if (_.get(a, label)) {
      return -1
    } else if (_.get(b, label)) {
      return 1
    } else {
      return 0
    }
  }
}

export async function filterBooksBySQLWrapper(filterType, bookList) {
  return await filterBooksBySQL(filterType, bookList, this.filterBooksByMemory)
}

export function filterBooksByMemory(filterType, bookList) {
  const startTime = performance.now()
  console.log(`🧠 开始内存筛选: ${filterType}`)

  let filteredBooks = []

  switch (filterType) {
    case 'mark':
      filteredBooks = _.filter(bookList, 'mark')
      break
    case 'hidden':
      filteredBooks = _.filter(bookList, 'hiddenBook')
      break
    case 'notag':
      filteredBooks = _.filter(bookList, this.isNoTag)
      break
    case 'nocategory':
      filteredBooks = _.filter(bookList, this.isNoCategory)
      break
    case 'duplicateGallery':
      filteredBooks = _.filter(bookList, book => isDuplicateGallery(book, this.bookList))
      break
    default:
      filteredBooks = bookList
  }

  const endTime = performance.now()
  const duration = endTime - startTime
  console.log(`✅ 内存筛选完成: ${filterType}, 耗时: ${duration.toFixed(2)}ms, 结果数量: ${filteredBooks.length}`)

  return filteredBooks
}

export function isNoTag(book){
  return book.status === 'non-tag' || book.status === 'tag-failed';
}

export function isNoCategory(book){
  return book.status === 'tagged' && (!book.category || book.category === '' || book.category === 'Misc');
}

export function getCollectTagMatchCount(book) {
  if (!book || !book.id) {
    return 0
  }

  if (this.collectTagMatchCache?.has?.(book.id)) {
    return this.collectTagMatchCache.get(book.id)
  }

  const matchCount = this.calculateCollectTagMatchCount(book)
  this.collectTagMatchCache?.set?.(book.id, matchCount)
  return matchCount
}

export function calculateCollectTagMatchCount(book) {
  if (!book || !book.tags || !Array.isArray(this.setting.collectTag)) {
    return 0
  }

  let matchCount = 0
  const bookTags = []

  Object.keys(book.tags).forEach(category => {
    if (Array.isArray(book.tags[category])) {
      book.tags[category].forEach(tag => {
        bookTags.push({ cat: category, tag: tag })
      })
    }
  })

  this.setting.collectTag.forEach(collectTag => {
    const isMatched = bookTags.some(bookTag =>
      bookTag.cat === collectTag.cat && bookTag.tag === collectTag.tag
    )
    if (isMatched) {
      matchCount++
    }
  })

  return matchCount
}


