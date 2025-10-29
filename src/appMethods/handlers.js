import { getWidth } from '../utils.js'

export function resolveKey(event) {
  let next, prev
  const ui = typeof this.currentUI === 'function' ? this.currentUI() : 'home'
  if (this.setting.reverseLeftRight) {
    ;({ next, prev } = this.keyMap.reverse)
  } else {
    ;({ next, prev } = this.keyMap.normal)
  }
  if (ui !== 'inputing') {
    if (event.key === 'Backspace') {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    }
  }
  if (ui === 'viewer-content') {
    if (this.$refs.InternalViewerRef.imageStyleType === 'single' || this.$refs.InternalViewerRef.imageStyleType === 'double') {
      if (event.key === next || event.key === 'ArrowDown' || event.key === ' ') {
        this.$refs.InternalViewerRef.currentImageIndex += 1
      }
      if (event.key === prev || event.key === 'ArrowUp') {
        this.$refs.InternalViewerRef.currentImageIndex -= 1
      }
      if (event.key === 'Home') {
        this.$refs.InternalViewerRef.currentImageIndex = 0
      }
      if (event.key === 'End') {
        if (this.$refs.InternalViewerRef.imageStyleType === 'single') {
          this.$refs.InternalViewerRef.currentImageIndex = this.$refs.InternalViewerRef.viewerImageList.length - 1
        } else if (this.$refs.InternalViewerRef.imageStyleType === 'double') {
          this.$refs.InternalViewerRef.currentImageIndex = this.$refs.InternalViewerRef.viewerImageListDouble.length - 1
        }
      }
    }
    if (this.$refs.InternalViewerRef.imageStyleType === 'double') {
      if (event.key === '/') {
        this.$refs.InternalViewerRef.insertEmptyPageIndex = this.$refs.InternalViewerRef.currentImageIndex
        this.$refs.InternalViewerRef.insertEmptyPage = !this.$refs.InternalViewerRef.insertEmptyPage
      }
    }
    if (this.$refs.InternalViewerRef.imageStyleType === 'scroll') {
      if (event.key === prev || event.key === 'ArrowUp') {
        if (event.ctrlKey) {
          document.querySelector('.viewer-drawer .el-drawer__body').scrollBy(0, -window.innerHeight / 10)
        } else {
          document.querySelector('.viewer-drawer .el-drawer__body').scrollBy(0, -window.innerHeight / 1.2)
        }
      }
      if (event.key === next || event.key === 'ArrowDown' || event.key === ' ') {
        if (event.ctrlKey) {
          document.querySelector('.viewer-drawer .el-drawer__body').scrollBy(0, window.innerHeight / 10)
        } else {
          document.querySelector('.viewer-drawer .el-drawer__body').scrollBy(0, window.innerHeight / 1.2)
        }
      }
      if (event.key === 'Home') {
        document.querySelector('.viewer-drawer .el-drawer__body').scrollTop = 0
      }
      if (event.key === 'End') {
        document.querySelector('.viewer-drawer .el-drawer__body').scrollTop = document.querySelector('.viewer-drawer .el-drawer__body').scrollHeight
      }
    }
  }
  if (ui === 'viewer-content' || ui === 'viewer-thumbnail') {
    if (event.key === 'PageDown') {
      if (event.shiftKey) {
        this.toNextMangaRandom()
      } else {
        this.toNextManga(1)
      }
    }
    if (event.key === 'PageUp') {
      this.toNextManga(-1)
    }
    if (event.key === '=') {
      this.$refs.InternalViewerRef.showThumbnail = !this.$refs.InternalViewerRef.showThumbnail
    }
    if (event.key === 'BrowserBack') {
      this.toNextManga(-1)
    }
    if (event.key === 'BrowserForward') {
      this.toNextManga(1)
    }
  }
  if (ui === 'bookdetail') {
    if (event.key === 'Enter') {
      event.preventDefault()
      this.$refs.InternalViewerRef.viewManga(this.bookDetail)
    }
    if (event.key === 'Delete') {
      this.$refs.BookDetailDialogRef.deleteLocalBook(this.bookDetail)
    }
    if (event.key === 'PageDown') {
      if (event.shiftKey) {
        this.jumpMangeDetailRandom()
      } else {
        this.jumpMangeDetail(1)
      }
    }
    if (event.key === 'PageUp') {
      this.jumpMangeDetail(-1)
    }
  }
  const bookEachLine = Math.floor(getWidth(document.querySelector('.book-card-area div:first-child'), 'width') / getWidth(document.querySelector('.book-card'), 'full'))
  if (ui === 'home') {
    if (event.key === 'Enter') {
      event.preventDefault()
      document.activeElement.querySelector('.book-cover').click()
    }
    if (event.key === 'F5') {
      this.loadBookList(true)
    }
    if (event.key === 'F6' || (event.ctrlKey && event.key === 'l')) {
      document.querySelector('.search-input .el-input__inner').select()
    }
    if (event.ctrlKey && event.key === 's') {
      this.shuffleBook()
    }
    if (event.key === 'PageUp') {
      event.preventDefault()
      this.currentPage -= 1
      this.handleCurrentPageChange(this.currentPage)
    }
    if (event.key === 'PageDown') {
      event.preventDefault()
      this.currentPage += 1
      this.handleCurrentPageChange(this.currentPage)
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      this.jumpBookByTabindex(bookEachLine, '.book-card-area')
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      this.jumpBookByTabindex(-bookEachLine, '.book-card-area')
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      this.jumpBookByTabindex(-1, '.book-card-area')
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      this.jumpBookByTabindex(1, '.book-card-area')
    }
  } else if (ui === 'collection') {
    if (event.key === 'Enter') {
      document.activeElement.querySelector('.book-cover').click()
    }
    if (event.key === 'ArrowDown') {
      this.jumpBookByTabindex(bookEachLine, '.collection-drawer')
    }
    if (event.key === 'ArrowUp') {
      this.jumpBookByTabindex(-bookEachLine, '.collection-drawer')
    }
    if (event.key === 'ArrowLeft') {
      this.jumpBookByTabindex(-1, '.collection-drawer')
    }
    if (event.key === 'ArrowRight') {
      this.jumpBookByTabindex(1, '.collection-drawer')
    }
  }
}

export function resolveWheel(event) {
  if (event.ctrlKey) {
    const level = electronFunction['get-zoom-level']()
    if (event.deltaY > 0) {
      electronFunction['set-zoom-level'](level - 1)
    } else {
      electronFunction['set-zoom-level'](level + 1)
    }
  }
}

export function resolveMouseDown(event) {
  if (event.button === 3) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    if (this.currentUI() === 'home') {
      if (this.currentPage === 1) {
        this.handleSearchStringChange()
        this.$refs.FolderTreeRef.resetSelect()
      } else {
        this.currentPage -= 1
        this.handleCurrentPageChange(this.currentPage)
      }
    } else if (this.$refs.BookDetailDialogRef.dialogVisibleBookDetail &&
        !this.$refs.SearchDialogRef.dialogVisibleEhSearch) {
      this.$refs.BookDetailDialogRef.dialogVisibleBookDetail = false
    }
  } else if (event.button === 4) {
    if (this.currentUI() === 'home') {
      if (this.currentPage * this.setting.pageSize < this.displayBookCount) {
        this.currentPage += 1
        this.handleCurrentPageChange(this.currentPage)
      }
    } else if (this.currentUI() === 'bookdetail' && !this.$refs.SearchDialogRef.dialogVisibleEhSearch) {
      this.jumpMangeDetail(1)
    }
  }
}

export function switchFullscreen() {
  ipcRenderer.invoke('switch-fullscreen')
}

export function jumpBookByTabindex(step, container) {
  try {
    const activeElement = document.activeElement
    if (!document.querySelector(container).contains(activeElement)) {
      throw new Error('active element not in container')
    }
    const tabIndexNow = activeElement.getAttribute('tabindex')
    const tabIndexNext = parseInt(tabIndexNow, 10) + step
    if (!(tabIndexNext >= 1)) throw new Error('detect illegal tabindex')
    document.querySelector(`${container} div[tabindex="${tabIndexNext}"]`).focus()
  } catch (error) {
    console.log(error)
    document.querySelector(`${container} div[tabindex="1"]`).focus()
  }
}

export function scrollMainPageTop() {
  document.getElementsByClassName('book-card-area')[0].scrollTop = 0
}

export function handleSizeChange() {
  this.chunkList()
  this.$refs.SettingRef.saveSetting()
  this.scrollMainPageTop()
}

export function handleCurrentPageChange(currentPage) {
  this.visibilityMap = {}
  this.chunkDisplayBookList = this.customChunk(this.displayBookList, this.setting.pageSize, currentPage - 1)
  this.scrollMainPageTop()
}


