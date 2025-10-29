export async function getBookListMetadata() {
  try {
    this.buttonGetMetadatasLoading = true
    let bookList
    if (this.setting.batchTagfailedBook) {
      bookList = this.bookList.filter(book => book.status === 'tag-failed' || book.status === 'non-tag')
    } else {
      bookList = this.bookList.filter(book => book.status === 'non-tag')
    }
    if (this.setting.onlyGetMetadataOfSelectedFolder) {
      bookList = bookList.filter(book => !book.folderHide)
    }
    await this.$refs.SearchDialogRef.getBooksMetadata(bookList, this.setting.requireGap || 10000)
    this.buttonGetMetadatasLoading = false
  } catch (error) {
    this.buttonGetMetadatasLoading = false
    console.error(error)
  }
}

export function shuffleBook() {
  this.sortValue = 'shuffle'
  this.displayBookList = _.shuffle(this.displayBookList)
  this.chunkList()
}

export function updateWindowTitle(book) {
  const title = this.getDisplayTitle(book)
  ipcRenderer.invoke('update-window-title', title)
}

export async function getMetadataFromClipboardLink(book) {
  const text = await ipcRenderer.invoke('read-text-from-clipboard')
  const url = text.trim()
  if (url) {
    book.url = url
    this.$refs.SearchDialogRef.getBookInfo(book)
  }
}

export async function translateBookToChinese(book) {
  try {
    this.printMessage('info', '正在使用AI生成中文翻译...')

    const translation = await ipcRenderer.invoke('translate-title-ai', {
      englishTitle: book.title,
      japaneseTitle: book.title_jpn,
      filename: path.basename(book.filepath)
    })

    await ipcRenderer.invoke('save-book-translation', {
      bookHash: book.hash || book.id,
      translation: translation
    })

    if (translation.fallback) {
      this.printMessage('warning', `中文翻译已生成（后备方案）: ${translation.chinese_title}`)
    } else {
      this.printMessage('success', `AI翻译完成: ${translation.chinese_title}`)
    }

    ipcRenderer.send('translation-updated', book.hash || book.id)
  } catch (e) {
    if (e.message.includes('only numbers or Chinese')) {
      this.printMessage('warning', '跳过翻译：文件名仅包含数字或中文字符')
    } else {
      this.printMessage('error', `翻译失败: ${e.message}`)
    }
  }
}

export async function regenerateBookCover(book) {
  try {
    this.printMessage('info', '正在重新生成封面...')
    await ipcRenderer.invoke('regenerate-cover', book.id)
    await this.loadBookList()
    this.printMessage('success', '封面已重新生成')
  } catch (e) {
    this.printMessage('error', `重新生成封面失败: ${e.message}`)
  }
}

export function onBookContextMenu(e, book) {
  e.preventDefault()
  this.$contextmenu({
    x: e.x,
    y: e.y,
    items: [
      { label: this.$t('m.getMetadata'), onClick: () => { this.$refs.SearchDialogRef.openSearchDialog(book) } },
      { label: this.$t('m.resetMetadata'), onClick: () => { this.resetMetadata(book) } },
      { label: this.$t('m.openMangaFileLocation'), onClick: () => { this.$refs.BookDetailDialogRef.showFile(book.filepath) } },
      { label: this.$t('m.moveFile'), onClick: () => { this.$refs.moveDlgRef.openMoveDialog(book) } },
      { label: this.$t('m.deleteFile'), onClick: () => { this.$refs.BookDetailDialogRef.deleteLocalBook(book) } },
      { label: this.$t('m.hideManga') + '/' + this.$t('m.showManga'), onClick: () => { this.$refs.BookDetailDialogRef.triggerHiddenBook(book) } },
      { label: this.$t('m.copyTagClipboard'), onClick: () => { this.copyTagClipboard(book) } },
      { label: this.$t('m.pasteTagClipboard'), onClick: () => { this.pasteTagClipboard(book) } },
      { label: this.$t('m.getMetadataFromClipboardLink'), onClick: () => { this.getMetadataFromClipboardLink(book) } },
      { label: this.$t('m.translateToChinese'), onClick: () => { this.translateBookToChinese(book) } },
      { label: this.$t('m.regenerateCover'), onClick: () => { this.regenerateBookCover(book) } },
      { label: this.$t('m.deleteCover'), onClick: async () => {
          try {
            await ipcRenderer.invoke('delete-cover', book.id)
            book.coverPath = null
            this.printMessage('success', this.$t('m.coverDeleted'))
          } catch (e) {
            this.printMessage('error', `Delete cover failed: ${e.message}`)
          }
        } },
    ]
  })
}

export function previewManga(book) {
  this.$refs.InternalViewerRef.showThumbnail = true
  this.$refs.InternalViewerRef.viewManga(book, '83%')
}

export function openContentView(book) {
  this.$refs.InternalViewerRef.showThumbnail = false
  this.$refs.InternalViewerRef.viewManga(book)
}

export function openThumbnailView(book) {
  this.$refs.InternalViewerRef.showThumbnail = true
  this.$refs.InternalViewerRef.viewManga(book)
}

export function toNextManga(step) {
  this.$refs.InternalViewerRef.handleStopReadManga()
  const activeBookList = this.drawerVisibleCollection ? this.openCollectionBookList : _.filter(this.displayBookList, book => this.isBook(book) && this.isVisibleBook(book))
  const indexNow = _.findIndex(activeBookList, { id: this.bookDetail.id })
  const indexNext = indexNow + step
  if (indexNext >= 0 && indexNext < activeBookList.length) {
    const selectBook = activeBookList[indexNext]
    setTimeout(() => {
      this.bookDetail = selectBook
      this.$refs.InternalViewerRef.viewManga(selectBook)
      this.comments = []
      if (this.setting.showComment) this.getComments(selectBook.url)
    }, 500)
  } else {
    this.printMessage('info', this.$t('c.outOfRange'))
  }
}

export function toNextMangaRandom() {
  this.$refs.InternalViewerRef.handleStopReadManga()
  const activeBookList = this.drawerVisibleCollection ? this.openCollectionBookList : _.filter(this.displayBookList, book => this.isBook(book) && this.isVisibleBook(book))
  const selectBook = _.sample(activeBookList)
  setTimeout(() => {
    this.bookDetail = selectBook
    this.$refs.InternalViewerRef.viewManga(selectBook)
    this.comments = []
    if (this.setting.showComment) this.getComments(selectBook.url)
  }, 500)
}

export function openBookDetailFromHistory(book) {
  if (!book) return
  if (this.$refs.BookHistoryButtonRef) {
    this.$refs.BookHistoryButtonRef.recordDetailOpen(book)
  }
  this.$refs.BookDetailDialogRef.openBookDetail(book)
}

export function recordDetailOpen(book) {
  if (!book) return
  if (this.$refs.BookHistoryButtonRef) {
    this.$refs.BookHistoryButtonRef.recordDetailOpen(book)
  }
}

export function jumpMangeDetail(step) {
  const activeBookList = this.drawerVisibleCollection ? this.openCollectionBookList : _.filter(this.displayBookList, book => this.isBook(book) && this.isVisibleBook(book))
  const indexNow = _.findIndex(activeBookList, { id: this.bookDetail.id })
  const indexNext = indexNow + step
  if (indexNext >= 0 && indexNext < activeBookList.length) {
    this.$refs.BookDetailDialogRef.openBookDetail(activeBookList[indexNext])
  } else {
    this.printMessage('info', this.$t('c.outOfRange'))
  }
}

export function jumpMangeDetailRandom() {
  const activeBookList = this.drawerVisibleCollection ? this.openCollectionBookList : _.filter(this.displayBookList, book => this.isBook(book) && this.isVisibleBook(book))
  this.$refs.BookDetailDialogRef.openBookDetail(_.sample(activeBookList))
}


