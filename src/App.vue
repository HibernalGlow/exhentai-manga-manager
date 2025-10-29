<template>
  <el-config-provider :locale="localeFile">
    <div id="progressbar" :style="{ width: progress + '%' }"></div>
    <el-button class="fullscreen-button" circle :icon="FullScreen" size="large" @click="switchFullscreen"></el-button>
    <SearchBar
      :search-string="searchString"
      :sort-value="sortValue"
      :setting="setting"
      :favorite-tags-for-search="favoriteTagsForSearch"
      :enable-mixed-gender-search="enableMixedGenderSearch"
      :favorite-tag-panel-visible="favoriteTagPanelVisible"
      :favorite-tag-panel-height="favoriteTagPanelHeight"
      :button-load-book-list-loading="buttonLoadBookListLoading"
      :button-get-metadatas-loading="buttonGetMetadatasLoading"
      :edit-tag-view="editTagView"
      :edit-collection-view="editCollectionView"
      :query-search="querySearch"
      :handle-search-focus="handleSearchFocus"
      :handle-search-blur="handleSearchBlur"
      :handle-search-string-change="handleSearchStringChange"
      :handle-input="handleInput"
      :append-collect-tag="appendCollectTag"
      :handle-panel-hide="handlePanelHide"
      :handle-panel-show="handlePanelShow"
      :update-panel-height="(h, ...rest) => updatePanelHeight(h, setting, () => $refs.SettingRef.saveSetting())"
      :apply-search-history="(q) => applySearchHistory(q)"
      :add-search-history="(q) => addSearchHistory(q)"
      @open-folder-tree="$refs.FolderTreeRef.openFolderTree()"
      @search-book="searchBook"
      @shuffle-book="shuffleBook"
      @load-book-list="(scan) => loadBookList(scan)"
      @get-book-list-metadata="getBookListMetadata"
      @open-tag-graph="$refs.TagGraphRef.displayTagGraph()"
      @open-setting="() => { $refs.SettingRef.dialogVisibleSetting = true }"
      @sort-change="(val) => handleSortChange(val)"
      @enter-edit-collection="$refs.EditViewRef.enterEditCollectionView()"
      @add-collection="$refs.EditViewRef.addCollection()"
      @edit-collection="$refs.EditViewRef.editCollection()"
      @save-collection="$refs.EditViewRef.saveCollection()"
      @exit-collection="$refs.EditViewRef.exitCollectionView()"
      @enter-edit-tag="$refs.EditViewRef.enterEditTagView()"
      @exit-edit-tag="$refs.EditViewRef.exitEditTagView()"
    >
      <template #left-extra>
        <BookHistoryButton :book-list="bookList" :setting="setting" @open-book-detail="openBookDetailFromHistory" ref="BookHistoryButtonRef" class="search-bar-button" />
      </template>
    </SearchBar>
    <RandomTags
        ref="randomTagsRef"
        v-if="!editTagView && !editCollectionView && !setting.disableRandomTag"
        @search="handleSearchString"
    />
    <el-row :gutter="20" class="book-card-area">
      <el-col :span="24" v-if="!editTagView && !editCollectionView" class="book-card-list"
              :style="{height: setting.disableRandomTag ? 'calc(100vh - 96px)' : 'calc(100vh - 134px)'}">
        <div
            v-for="(book, index) in visibleChunkDisplayBookList"
            :key="book.id"
            class="book-card-frame"
            v-lazy:[book.id]="loadBookCardContent"
            :tabindex="index + 1"
        >
          <transition name="pop">
            <!-- show book card when book isn't a collection, book isn't hidden because collected,
              and book isn't hidden by user except sorting by onlyHiddenBook
              and book isn't hidden by folder select -->
            <BookCard
                :book="book"
                :search-string="searchString"
                v-if="!book.isCollection && !book.collectionHide && (sortValue === 'hidden' || !book.hiddenBook) && !book.folderHide && visibilityMap[book.id]"
                @open-book-detail="openBookDetailFromHistory(book)"
                @handle-click-cover="handleClickCover(book)"
                @on-book-context-menu="onBookContextMenu"
                @handle-search-string="handleSearchString"
                @search-from-tag="searchFromTag"
                @open-local-book="$refs.BookDetailDialogRef.openLocalBook(book)"
                @view-manga="$refs.InternalViewerRef.viewManga(book)"
            />
            <BookCardCollection
                :book="book"
                v-else-if="book.isCollection && !book.folderHide && visibilityMap[book.id]"
                @open-collection="openCollection(book)"
            />
          </transition>
        </div>
      </el-col>
      <EditView
          ref="EditViewRef"
          @preview-manga="previewManga"
          @search-from-tag="searchFromTag"
          @load-book-list="loadBookList"
          @get-books-metadata="(bookList, gap, callback) => $refs.SearchDialogRef.getBooksMetadata(bookList, gap, callback)"
          @handle-remove-book-display="handleRemoveBookDisplay"
      />
    </el-row>
    <PaginationBar
        v-model:currentPage="currentPage"
        v-model:pageSize="setting.pageSize"
        :total="displayBookCount"
        @size-change="handleSizeChange"
        @current-change="handleCurrentPageChange"
    />
    <CollectionDrawer
        v-model="drawerVisibleCollection"
        :title="openCollectionTitle"
        :book-list="openCollectionBookList"
        :search-string="searchString"
        @edit-current-collection="editCurrentCollection"
        @open-book-detail="openBookDetailFromHistory"
        @handle-click-cover="handleClickCover"
        @on-book-context-menu="onBookContextMenu"
        @handle-search-string="handleSearchString"
        @search-from-tag="searchFromTag"
        @open-local-book="(book) => $refs.BookDetailDialogRef.openLocalBook(book)"
        @view-manga="(book) => $refs.InternalViewerRef.viewManga(book)"
    />
    <MoveFileDialog ref="moveDlgRef" :save-book-fn="saveBook"/>
    <BookDetailDialog
        ref="BookDetailDialogRef"
        :search-string="searchString"
        @open-content-view="openContentView"
        @open-thumbnail-view="openThumbnailView"
        @save-collection="$refs.EditViewRef.saveCollection()"
        @handle-remove-book-display="handleRemoveBookDisplay"
        @open-search-dialog="$refs.SearchDialogRef.openSearchDialog(bookDetail)"
        @get-book-info="$refs.SearchDialogRef.getBookInfo(bookDetail)"
        @search-from-tag="searchFromTag"
        @jump-mange-detail="jumpMangeDetail"
        @detail-opened="recordDetailOpen"
    />
    <InternalViewer
        ref="InternalViewerRef"
        @to-next-manga="toNextManga"
        @to-next-manga-random="toNextMangaRandom"
        @update-window-title="updateWindowTitle"
        @rescan-book="(book) => $refs.BookDetailDialogRef.rescanBook(book)"
    />
    <FolderTree ref="FolderTreeRef" @chunk-list="chunkList" @search="handleSearchString"/>
    <TagGraph ref="TagGraphRef" @search="handleSearchString"/>
    <SearchDialog ref="SearchDialogRef"/>
    <Setting ref="SettingRef" @load-book-list="loadBookList" @load-collection-list="loadCollectionList"/>
  </el-config-provider>
</template>

<script>
import { defineComponent } from 'vue'
import { Setting as SettingIcon, FullScreen, Edit } from '@element-plus/icons-vue'
import { ArrowTrendingLines20Filled, Collections24Regular, Search32Filled, Save16Regular } from '@vicons/fluent'
import { MdShuffle, MdRefresh, MdCodeDownload, MdExit } from '@vicons/ionicons4'
import { TreeViewAlt, CicsSystemGroup, TagGroup } from '@vicons/carbon'

import { getWidth, fetchRecentReads } from './utils.js'
import { filterBooksBySQL, sortByUrlGroup, isDuplicateGallery } from '../modules/sqlFilter.js'

import Setting from './components/Setting.vue'
import TagGraph from './components/TagGraph.vue'
import InternalViewer from './components/InternalViewer.vue'
import SearchDialog from './components/SearchDialog.vue'
import BookDetailDialog from './components/BookDetailDialog.vue'
import FolderTree from './components/FolderTree.vue'
import BookCard from './components/BookCard.vue'
import BookCardCollection from './components/BookCardCollection.vue'
import EditView from './components/EditView.vue'
import RandomTags from './components/RandomTags.vue'
import MoveFileDialog from './components/MoveFileDialog.vue'
import FavoriteTagPanel from './components/FavoriteTagPanel.vue'
import SearchAgilePanel from './components/SearchAgilePanel.vue'
import BookHistoryButton from './components/BookHistoryButton.vue'
import SearchBar from './components/AppComponents/SearchBar.vue'
import PaginationBar from './components/AppComponents/PaginationBar.vue'
import CollectionDrawer from './components/AppComponents/CollectionDrawer.vue'

import './App.styl'

import { mapWritableState, mapActions } from 'pinia'
import { useAppStore, toPlain } from './pinia.js'

import { useSearch } from './composables/useSearch.js'
import { useCollectTagMatch } from './composables/useCollectTagMatch.js'
import { useDuplicateGallery } from './composables/useDuplicateGallery.js'

export default defineComponent({
  components: {
    Setting,
    TagGraph,
    InternalViewer,
    SearchDialog,
    BookDetailDialog,
    FolderTree,
    BookCard,
    BookCardCollection,
    EditView,
    RandomTags,
    MoveFileDialog,
    FavoriteTagPanel,
    SearchAgilePanel,
    BookHistoryButton,
    SearchBar,
    PaginationBar,
    CollectionDrawer
  },
  setup() {
    const searchComposable = useSearch()
    const collectTagMatchComposable = useCollectTagMatch()
    const duplicateGalleryComposable = useDuplicateGallery()

    return {
      SettingIcon, FullScreen, Edit,
      Collections24Regular, Search32Filled, ArrowTrendingLines20Filled, Save16Regular,
      MdRefresh, MdCodeDownload, MdExit, MdShuffle,
      TreeViewAlt, CicsSystemGroup, TagGroup,
      ...searchComposable,
      ...collectTagMatchComposable,
      ...duplicateGalleryComposable
    }
  },
  provide() {
    return {
      enableMixedGenderSearch: () => this.enableMixedGenderSearch
    }
  },
  data() {
    return {
      // home
      searchString: '',
      currentPage_: 1,
      progress: 0,
      randomTags: [],
      visibilityMap: {},
      buttonLoadBookListLoading: false,
      buttonGetMetadatasLoading: false,
      // collection
      drawerVisibleCollection: false,
      openCollectionTitle: undefined,
    }
  },
  computed: {
    ...mapWritableState(useAppStore, [
      'cat2letter',
      'keyMap',
      'categoryOption',
      'setting',
      'bookDetail',
      'bookList',
      'displayBookList',
      'chunkDisplayBookList',
      'collectionList',
      'openCollectionBookList',
      'serviceAvailable',
      'sortValue',
      'editCollectionView',
      'editTagView',
      'folderTreeData',
      'localeFile',
      'displayBookCount',
      'tagList',
      'tag2cat',
      'customOptions',
      'visibleChunkDisplayBookList',
      'resolvedTranslation',
    ]),
    currentPage: {
      get() {
        return this.currentPage_
      },
      set(val) {
        const pageLimit = Math.ceil(this.displayBookCount / this.setting.pageSize)
        if (Number.isInteger(val)) {
          if (val < 1) {
            this.currentPage_ = 1
          } else if (val > pageLimit) {
            this.currentPage_ = pageLimit
          } else {
            this.currentPage_ = val
          }
        }
      }
    },
    favoriteTagsForSearch() {
      const collectTag = Array.isArray(this.setting?.collectTag) ? this.setting.collectTag : []
      const translations = this.resolvedTranslation || {}

      // 转换标签数据
      const processedTags = collectTag.map(tag => {
        const translatedCat = this.setting.showTranslation
          ? (translations[tag.cat]?.name || tag.cat)
          : tag.cat
        const translatedTag = this.setting.showTranslation
          ? (translations[tag.tag]?.name || tag.tag)
          : tag.tag
        return {
          ...tag,
          value: `${tag.letter}:"${tag.tag}"$`,
          display: `${translatedCat}:${translatedTag}`,
          translatedCat,
          translatedTag
        }
      })

      // 按照类别分组和排序
      const groupedTags = {}
      processedTags.forEach(tag => {
        if (!groupedTags[tag.translatedCat]) {
          groupedTags[tag.translatedCat] = []
        }
        groupedTags[tag.translatedCat].push(tag)
      })

      // 对每个类别内的标签按字母顺序排序
      Object.keys(groupedTags).forEach(cat => {
        groupedTags[cat].sort((a, b) => a.translatedTag.localeCompare(b.translatedTag))
      })

      // 对类别按字母顺序排序，然后合并所有标签
      const sortedCategories = Object.keys(groupedTags).sort()
      const sortedTags = []
      sortedCategories.forEach(cat => {
        sortedTags.push(...groupedTags[cat])
      })

      return sortedTags
    }
  },
  mounted() {
    ipcRenderer.on('send-message', (event, arg) => {
      this.printMessage('info', arg)
      if (arg.includes('failed')) {
        console.error(arg)
      } else {
        console.log(arg)
      }
    })
    ipcRenderer.invoke('load-setting')
        .then(async (res) => {
          this.setting = res
          if (this.setting.loadOnStart) {
            // skip the cache and rescan all libraries
            // await this.loadBookList()
            await this.loadBookList(true)
          } else {
            try {
              await this.loadCache()
            } catch (e) {
              console.error('Fail to load cache, loading exiting books', e)
              await this.loadBookList()
            }
          }
        })
    this.sortValue = localStorage.getItem('sortValue')
    this.sortValue = this.sortValue === 'null' ? undefined : this.sortValue === 'undefined' ? undefined : this.sortValue
    window.addEventListener('keydown', this.resolveKey)
    window.addEventListener('wheel', this.resolveWheel)
    window.addEventListener('mousedown', this.resolveMouseDown)
    ipcRenderer.on('send-action', async (event, arg) => {
      switch (arg.action) {
        case 'setting':
          this.$refs.SettingRef.dialogVisibleSetting = true
          this.$refs.SettingRef.activeSettingPanel = 'general'
          break
        case 'about':
          this.$refs.SettingRef.dialogVisibleSetting = true
          this.$refs.SettingRef.activeSettingPanel = 'about'
          break
        case 'accelerator':
          this.$refs.SettingRef.dialogVisibleSetting = true
          this.$refs.SettingRef.activeSettingPanel = 'accelerator'
          break
        case 'send-progress':
          this.progress = +arg.progress > 1 ? 100 : +arg.progress < 0 ? 0 : +arg.progress * 100
          break
        case 'tag-fail-non-tag-book':
          if (this.currentUI() === 'home') {
            for (const book of this.displayBookList) {
              if (book.status === 'non-tag' && this.isBook(book) && this.isVisibleBook(book)) {
                book.status = 'tag-failed'
                await this.saveBook(book)
              }
            }
          }
          break
      }
    })
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this.resolveKey)
    window.removeEventListener('wheel', this.resolveWheel)
    window.removeEventListener('mousedown', this.resolveMouseDown)
  },
  watch: {
    bookList() {
      this.handleSortChange(this.sortValue, this.bookList)
      // 书籍列表改变时重新计算收藏标签匹配缓存
      this.recalculateCollectTagMatchCache(this.bookList, this.setting.collectTag)
      // 重新构建重复画廊数量缓存
      this.buildDuplicateCountCache()
    },
    'setting.collectTag': {
      handler() {
        // 收藏标签改变时重新计算缓存
        this.recalculateCollectTagMatchCache(this.bookList, this.setting.collectTag)
      },
      deep: true
    },
  },
  methods: {
    ...mapActions(useAppStore, [
      'isBook',
      'isVisibleBook',
      'printMessage',
      'getDisplayTitle',
      'resetMetadata',
      'saveBook',
      'copyTagClipboard',
      'pasteTagClipboard',
    ]),

    handleSearchFocus() {
      // 总是显示面板（即使没有收藏标签也可以显示搜索历史）
      this.clearFavoriteHideTimer()
      this.favoriteTagPanelVisible = true
    },
    handlePanelShow() {
      // Tab切换时重新显示面板，防止输入框blur导致面板消失
      this.clearFavoriteHideTimer()
      this.favoriteTagPanelVisible = true
    },
    handleSearchBlur() {
      this.scheduleFavoriteHide()
    },
    appendCollectTag(tag, modifier = '', event) {
      this.appendCollectTag(tag, modifier, event, this.searchString, this.handleInput, this.$refs.searchAutocomplete)
    },
    handlePanelHide() {
      this.handlePanelHide()
    },
    updatePanelHeight(height) {
      this.updatePanelHeight(height, this.setting, () => this.$refs.SettingRef.saveSetting())
    },
    addSearchHistory(query) {
      this.addSearchHistory(query, this.$refs.searchAgilePanelRef)
    },
    applySearchHistory(query) {
      this.applySearchHistory(query, this.searchString, this.searchBook)
    },

    // 计算书籍匹配收藏标签的数量（带缓存）
    getCollectTagMatchCount(book) {
      if (!book || !book.id) {
        return 0
      }

      // 检查缓存中是否已有计算结果
      if (this.collectTagMatchCache.has(book.id)) {
        return this.collectTagMatchCache.get(book.id)
      }

      // 如果没有缓存，计算并缓存结果
      const matchCount = this.calculateCollectTagMatchCount(book)
      this.collectTagMatchCache.set(book.id, matchCount)
      return matchCount
    },

    // 实际的计算逻辑
    calculateCollectTagMatchCount(book) {
      if (!book || !book.tags || !Array.isArray(this.setting.collectTag)) {
        return 0
      }

      let matchCount = 0
      const bookTags = []

      // 收集书籍的所有标签
      Object.keys(book.tags).forEach(category => {
        if (Array.isArray(book.tags[category])) {
          book.tags[category].forEach(tag => {
            bookTags.push({ cat: category, tag: tag })
          })
        }
      })

      // 检查每个收藏标签是否匹配
      this.setting.collectTag.forEach(collectTag => {
        const isMatched = bookTags.some(bookTag =>
          bookTag.cat === collectTag.cat && bookTag.tag === collectTag.tag
        )
        if (isMatched) {
          matchCount++
        }
      })

      return matchCount
    },



    // base function
    currentUI() {
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
        return 'inputing'
      }
      if (!!document.querySelector('.is-message-box')) {
        return 'message-box'
      }
      if (this.$refs.SettingRef.dialogVisibleSetting) {
        return 'setting'
      }
      if (this.$refs.SearchDialogRef.dialogVisibleEhSearch) {
        return 'search-dialog'
      }
      if (this.$refs.InternalViewerRef.drawerVisibleViewer) {
        if (this.$refs.InternalViewerRef.showThumbnail) {
          return 'viewer-thumbnail'
        } else {
          return 'viewer-content'
        }
      }
      if (this.$refs.BookDetailDialogRef.dialogVisibleBookDetail) {
        if (this.$refs.BookDetailDialogRef.editingTag) {
          return 'edit-tag'
        } else {
          return 'bookdetail'
        }
      }
      if (this.$refs.TagGraphRef.dialogVisibleGraph) {
        return 'tag-graph'
      }
      if (this.$refs.FolderTreeRef.sideVisibleFolderTree) {
        return 'folder-tree'
      }
      if (this.$refs.EditViewRef.editCollectionView) {
        return 'edit-collection'
      }
      if (this.$refs.EditViewRef.editTagView) {
        return 'edit-group-tag'
      }
      if (this.drawerVisibleCollection) {
        return 'collection'
      }
      return 'home'
    },
    resolveKey(event) {
      let next, prev
      if (this.setting.reverseLeftRight) {
        ;({ next, prev } = this.keyMap.reverse)
      } else {
        ;({ next, prev } = this.keyMap.normal)
      }
      if (this.currentUI() !== 'inputing') {
        if (event.key === 'Backspace') {
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
        }
      }
      if (this.currentUI() === 'viewer-content') {
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
      if (this.currentUI() === 'viewer-content' || this.currentUI() === 'viewer-thumbnail') {
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
      if (this.currentUI() === 'bookdetail') {
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
      if (this.currentUI() === 'home') {
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
      } else if (this.currentUI() === 'collection') {
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
    },
    resolveWheel(event) {
      if (event.ctrlKey) {
        const level = electronFunction['get-zoom-level']()
        if (event.deltaY > 0) {
          electronFunction['set-zoom-level'](level - 1)
        } else {
          electronFunction['set-zoom-level'](level + 1)
        }
      }
    },
    resolveMouseDown(event) {
      // backward button=3 and forward button=4
      if (event.button === 3) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
        // clear search result when at home page
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
          // close the book detail dialog by mouse backward button
          this.$refs.BookDetailDialogRef.dialogVisibleBookDetail = false
        }
      } else if (event.button === 4) {
        if (this.currentUI() === 'home') {
          if (this.currentPage * this.setting.pageSize < this.displayBookCount) {
            this.currentPage += 1
            this.handleCurrentPageChange(this.currentPage)
          }
        } else if (this.currentUI() === 'bookdetail' && !this.$refs.SearchDialogRef.dialogVisibleEhSearch) {
          // open the next book by mouse forward button
          this.jumpMangeDetail(1)
        }
      }
    },
    switchFullscreen() {
      ipcRenderer.invoke('switch-fullscreen')
    },
    customChunk(list, size, index) {
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
    },
    sortList(label) {
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
    },
    async loadCache() {
      // load bookList, collectionList, geneFolderTree
      // called at the app mounted; new cache is saved after every scan
      const { appCache, dbSignature } = await ipcRenderer.invoke('load-app-cache')
      if (await ipcRenderer.invoke('should-use-cache', dbSignature)) {
        // 批量加载翻译数据
        const bookHashes = appCache.bookList.map(book => book.hash || book.id)
        const translations = await ipcRenderer.invoke('get-translations-batch', bookHashes)
        
        // 将翻译数据附加到书籍对象上
        for (const book of appCache.bookList) {
          const bookHash = book.hash || book.id
          if (translations[bookHash]) {
            book._translation = translations[bookHash]
          }
        }
        
        this.bookList = appCache.bookList
        this.$refs.FolderTreeRef.loadTreeCache(appCache.treeCache)
        this.$refs.EditViewRef.selectBookList = []
        // this.loadCollectionList()
        this.handleSortChange(this.sortValue, this.bookList)
        // 预计算收藏标签匹配缓存
        this.recalculateCollectTagMatchCache()
        // 预计算重复画廊数量缓存
        this.buildDuplicateCountCache()
        console.log('cached loaded')
      } else {
        throw new Error('Database changed, skip cache')
      }

    },
    async loadBookList(scan) {
      try {
        this.buttonLoadBookListLoading = true
        const res = await ipcRenderer.invoke('load-book-list', scan)

        // Synchronously parse tags before assigning to reactive state
        for (const book of res) {
          if (book && typeof book.tags === 'string') {
            try {
              book.tags = JSON.parse(book.tags || '{}');
            } catch (e) {
              console.error(`[App.vue] Failed to parse tags for book ${book.id}:`, e);
              book.tags = {}; // Reset to empty object on failure
            }
          }
        }

        // 批量加载翻译数据
        const bookHashes = res.map(book => book.hash || book.id)
        const translations = await ipcRenderer.invoke('get-translations-batch', bookHashes)
        
        // 将翻译数据附加到书籍对象上
        for (const book of res) {
          const bookHash = book.hash || book.id
          if (translations[bookHash]) {
            book._translation = translations[bookHash]
          }
        }

        this.bookList = this.prepareBookList(res)

        // FIX: Refresh open book detail dialog with new data
        if (this.bookDetail?.id) {
          const updatedBook = this.bookList.find(b => b.id === this.bookDetail.id);
          if (updatedBook) {
            this.bookDetail = updatedBook;
          }
        }

        this.$refs.FolderTreeRef.geneFolderTree(this.tagListRaw)
        // mirror a live cache at the end of loading books
        // this function is called after scan, force-gene-book-list, patch-local-metadata
        this.loadCollectionList()
        this.$refs.EditViewRef.selectBookList = []
        this.buttonLoadBookListLoading = false
      } catch (error) {
        this.buttonLoadBookListLoading = false
        console.error(error)
      }
      if (scan) this.printMessage('success', this.$t('c.scanComplete'))
    },
    prepareBookList(bookList) {
      bookList.forEach(book => {
        if (Number.isInteger(book.filecount) && Number.isInteger(book.pageCount) && Math.abs(book.filecount - book.pageCount) > 5) book.pageDiff = true
      })
      return bookList
    },
    updateWindowTitle(book) {
      const title = this.getDisplayTitle(book)
      ipcRenderer.invoke('update-window-title', title)
    },

    // home header
    async getBookListMetadata() {
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
    },
    shuffleBook() {
      this.sortValue = 'shuffle'
      this.displayBookList = _.shuffle(this.displayBookList)
      this.chunkList()
    },
    handleSortChange(val, bookList) {
      if (!bookList) bookList = this.displayBookList

      // 对于支持SQL查询的筛选类型，使用数据库查询优化性能
      const sqlSupportedFilters = ['mark', 'hidden', 'notag', 'nocategory', 'duplicateGallery']

      if (sqlSupportedFilters.includes(val)) {
        // 使用SQL查询
        this.filterBooksBySQLWrapper(val, bookList).then(filteredBooks => {
          this.displayBookList = filteredBooks
          this.chunkList()
        }).catch(error => {
          console.error('SQL筛选失败:', error)
          // 回退到内存过滤
          this.handleSortChangeFallback(val, bookList)
        })
        return
      }

      // 对于其他筛选类型，使用原来的逻辑
      this.handleSortChangeFallback(val, bookList)
    },

    // 原有的handleSortChange逻辑，作为回退方案
    handleSortChangeFallback(val, bookList) {
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
    },
    querySearch(queryString, callback) {
      let result = []
      const options = this.customOptions.concat(this.tagList)
      if (queryString) {
        const keywords = [...queryString.matchAll(/\s+(?=(?:[^\'"]*[\'"][^\'"]*[\'"])*[^\'"]*$)/g)]
        if (!_.isEmpty(keywords)) {
          const nextKeyword = queryString.replace(/(~|-)?[\p{L}\d]+:"[- ._()\p{L}\d]+"\$/gu, '').trim()
          if (nextKeyword[0] === '-' || nextKeyword[0] === '~') {
            result = _.filter(options, (str) => {
              return _.includes(str.value.toLowerCase(), nextKeyword.slice(1).toLowerCase())
                  || _.includes(str.label.toLowerCase(), nextKeyword.slice(1).toLowerCase())
            })
          } else {
            result = _.filter(options, (str) => {
              return _.includes(str.value.toLowerCase(), nextKeyword.toLowerCase())
                  || _.includes(str.label.toLowerCase(), nextKeyword.toLowerCase())
            })
          }
        } else {
          if (queryString[0] === '-' || queryString[0] === '~') {
            result = _.filter(options, (str) => {
              return _.includes(str.value.toLowerCase(), queryString.slice(1).toLowerCase())
                  || _.includes(str.label.toLowerCase(), queryString.slice(1).toLowerCase())
            })
          } else {
            result = _.filter(options, (str) => {
              return _.includes(str.value.toLowerCase(), queryString.toLowerCase())
                  || _.includes(str.label.toLowerCase(), queryString.toLowerCase())
            })
          }
        }
      } else {
        result = options
      }
      callback(result)
    },
    handleSearchStringChange(val) {
      if (!val) {
        this.searchString = ''
        this.handleSortChange(this.sortValue, this.bookList)
      }
    },
    handleInput(val) {
      try {
        if (/^[\p{L}\d]+:"[- ._()\p{L}\d]+"\$$/u.test(val)
            && this.searchString.trim() !== val.trim()) {
          const keywords = [...this.searchString.trim().matchAll(/\s+(?=(?:[^\'"]*[\'"][^\'"]*[\'"])*[^\'"]*$)/g)]
          if (!_.isEmpty(keywords)) {
            const keyword = this.searchString.replace(/(~|-)?[\p{L}\d]+:"[- ._()\p{L}\d]+"\$/gu, '').trim()
            const matches = this.searchString.match(/(~|-)?[\p{L}\d]+:"[- ._()\p{L}\d]+"\$/gu)
            if (keyword[0] === '-') {
              this.searchString = matches.concat([`-${val}`]).join(' ')
            } else if (keyword[0] === '~') {
              this.searchString = matches.concat([`~${val}`]).join(' ')
            } else {
              this.searchString = matches.concat([val]).join(' ')
            }
          } else {
            const keyword = this.searchString.trim()
            if (keyword[0] === '-') {
              this.searchString = `-${val}`
            } else if (keyword[0] === '~') {
              this.searchString = `~${val}`
            } else {
              this.searchString = val
            }
          }
        } else {
          this.searchString = val
          this.searchString = this.searchString.replace(/\|{3}/, ' ')
        }
      } catch {
        this.searchString = val
      }
    },
    searchBook() {
      const checkCondition = (bookString, bookInfo, enableMixed, cat2letter) => {
        const searchStringArray = this.searchString ? this.searchString.split(/\s+(?=(?:[^\'"]*[\'"][^\'"]*[\'"])*[^\'"]*$)/) : []
        const orCondition = _.filter(searchStringArray, (str) => str.startsWith('~'))
        const andCondition = _.filter(searchStringArray, (str) => !str.startsWith('~'))
        return _.some([andCondition, ...orCondition], (condition) => {
          if (_.isArray(condition)) {
            return _.every(condition, (str) => {
              try {
                if (_.startsWith(str, ':')) {
                  const type = str.slice(1, 6)
                  if (str[6] === '>') {
                    switch (type) {
                      case 'mtime':
                      case 'atime':
                      case 'ptime':
                        return bookInfo[type] >= new Date(str.slice(7))
                      case 'count':
                        return bookInfo[type] > parseInt(str.slice(7), 10)
                    }
                  } else if (str[6] === '<') {
                    switch (type) {
                      case 'mtime':
                      case 'atime':
                      case 'ptime':
                        return bookInfo[type] <= new Date(str.slice(7))
                      case 'count':
                        return bookInfo[type] < parseInt(str.slice(7), 10)
                    }
                  } else if (str[6] === '=') {
                    switch (type) {
                      case 'mtime':
                      case 'atime':
                      case 'ptime':
                        return bookInfo[type].toLocaleDateString() === new Date(str.slice(7)).toLocaleDateString()
                      case 'count':
                        return bookInfo[type] === parseInt(str.slice(7), 10)
                    }
                  } else {
                    return false
                  }
                } else if (str.match(/^([a-z]+):"([^"]+)"\$/)) {
                  const cat = RegExp.$1
                  const tag = RegExp.$2
                  const cats = enableMixed && ['f','m','x'].includes(cat) ? ['f','m','x'] : [cat]
                  return cats.some(c => {
                    const letter = cat2letter?.[c] || c
                    return bookString.includes(`${letter}:${tag}`) || bookString.includes(`${c}:${tag}`)
                  })
                } else if (str.match(/^-([a-z]+):"([^"]+)"\$/)) {
                  const cat = RegExp.$1
                  const tag = RegExp.$2
                  const cats = enableMixed && ['f','m','x'].includes(cat) ? ['f','m','x'] : [cat]
                  return !cats.some(c => {
                    const letter = cat2letter?.[c] || c
                    return bookString.includes(`${letter}:${tag}`) || bookString.includes(`${c}:${tag}`)
                  })
                } else if (_.startsWith(str, '-')) {
                  return !bookString.includes(str.slice(1).replace(/["']/g, '').replace(/[$]/g, '"').toLowerCase())
                } else {
                  return bookString.includes(str.replace(/["']/g, '').replace(/[$]/g, '"').toLowerCase())
                }
              } catch {
                return false
              }
            })
          } else {
            const str = condition.slice(1)
            if (str.match(/^([a-z]+):"([^"]+)"\$/)) {
              const cat = RegExp.$1
              const tag = RegExp.$2
              const cats = enableMixed && ['f','m','x'].includes(cat) ? ['f','m','x'] : [cat]
              return cats.some(c => {
                const letter = cat2letter?.[c] || c
                return bookString.includes(`${letter}:${tag}`) || bookString.includes(`${c}:${tag}`)
              })
            } else {
              return bookString.includes(str.replace(/["']/g, '').replace(/[$]/g, '"').toLowerCase())
            }
          }
        })
      }
      this.displayBookList = _.filter(this.bookList, (book) => {
        const tagTokens = _.flatMap(book.tags, (tags, cat) => {
          const letter = this.cat2letter?.[cat] || cat
          return _.flatMap(tags, (tag) => [
            `${letter}:${tag}`,
            `${cat}:${tag}`,
          ])
        })
        const categoryToken = book.category ? [`cat:${book.category}`] : []
        // 获取书籍的翻译标题
        const getBookTranslation = (book) => {
          if (book._translation) {
            return book._translation.chinese_title || ''
          }
          return ''
        }
        
        const bookString = JSON.stringify(
            _.assign(
                {},
                _.pick(book, ['title', 'title_jpn', 'status', 'filepath', 'url', 'pageDiff']),
                {
                  tags: tagTokens.concat(categoryToken),
                  chinese_title: getBookTranslation(book)
                }
            )
        ).toLowerCase()
        const bookInfo = {
          mtime: new Date(book.mtime),
          atime: new Date(book.date),
          ptime: new Date(book.posted * 1000),
          count: book.readCount
        }
        return checkCondition(bookString, bookInfo, this.enableMixedGenderSearch, this.cat2letter)
      })
      if (!this.sortValue || ['mark', 'hidden', 'collection'].includes(this.sortValue)) this.sortValue = 'addDescend'
      this.handleSortChange(this.sortValue, this.displayBookList)
      // 添加搜索历史记录
      if (this.searchString && this.searchString.trim()) {
        this.addSearchHistory(this.searchString.trim())
      }
      if (this.currentUI() === 'edit-group-tag') {
        this.$refs.EditViewRef.selectBookList = []
        this.displayBookList.forEach(book => book.selected = false)
      }
    },
    handleSearchString(string) {
      this.$refs.BookDetailDialogRef.dialogVisibleBookDetail = false
      this.drawerVisibleCollection = false
      this.searchString = string
      this.searchBook()
    },
    searchFromTag(tag, cat) {
      this.$refs.BookDetailDialogRef.dialogVisibleBookDetail = false
      this.drawerVisibleCollection = false
      if (cat) {
        const letter = this.cat2letter[cat] ? this.cat2letter[cat] : cat
        this.searchString = `${letter}:"${tag}"$`
      } else {
        this.searchString = `"${tag}"$`
      }
      this.searchBook()
    },
    // home main
    handleClickCover(book) {
      switch (this.setting.directEnter) {
        case 'internalViewer':
          this.$refs.InternalViewerRef.viewManga(book)
          break
        case 'externalViewer':
          this.$refs.BookDetailDialogRef.openLocalBook(book)
          break
        default:
          this.$refs.BookDetailDialogRef.openBookDetail(book)
          break
      }
    },
    jumpBookByTabindex(step, container) {
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
    },
    loadBookCardContent(id) {
      this.visibilityMap[id] = true
    },
    chunkList() {
      this.currentPage = 1
      this.chunkDisplayBookList = this.customChunk(this.displayBookList, this.setting.pageSize, 0)
      this.scrollMainPageTop()
    },
    handleSizeChange() {
      this.chunkList()
      this.$refs.SettingRef.saveSetting()
      this.scrollMainPageTop()
    },
    handleCurrentPageChange(currentPage) {
      this.visibilityMap = {}
      this.chunkDisplayBookList = this.customChunk(this.displayBookList, this.setting.pageSize, currentPage - 1)
      this.scrollMainPageTop()
    },
    scrollMainPageTop() {
      document.getElementsByClassName('book-card-area')[0].scrollTop = 0
    },

    async getMetadataFromClipboardLink(book) {
      const text = await ipcRenderer.invoke('read-text-from-clipboard')
      const url = text.trim()
      if (url) {
        book.url = url
        this.$refs.SearchDialogRef.getBookInfo(book)
      }
    },

    async translateBookToChinese(book) {
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

        // 根据是否使用了后备方案显示不同的消息
        if (translation.fallback) {
          this.printMessage('warning', `中文翻译已生成（后备方案）: ${translation.chinese_title}`)
        } else {
          this.printMessage('success', `AI翻译完成: ${translation.chinese_title}`)
        }

        // 通知所有 BookCard 更新翻译
        ipcRenderer.send('translation-updated', book.hash || book.id)
      } catch (e) {
        if (e.message.includes('only numbers or Chinese')) {
          this.printMessage('warning', '跳过翻译：文件名仅包含数字或中文字符')
        } else {
          this.printMessage('error', `翻译失败: ${e.message}`)
        }
      }
    },

    async regenerateBookCover(book) {
      try {
        this.printMessage('info', '正在重新生成封面...')
        
        // 调用现有的封面生成逻辑
        await ipcRenderer.invoke('regenerate-cover', book.id)
        
        // 重新加载书籍列表以更新封面
        await this.loadBookList()
        
        this.printMessage('success', '封面已重新生成')
      } catch (e) {
        this.printMessage('error', `重新生成封面失败: ${e.message}`)
      }
    },
    onBookContextMenu(e, book) {
      e.preventDefault()
      this.$contextmenu({
        x: e.x,
        y: e.y,
        items: [
          {
            label: this.$t('m.getMetadata'),
            onClick: () => {
              this.$refs.SearchDialogRef.openSearchDialog(book)
            }
          },
          {
            label: this.$t('m.resetMetadata'),
            onClick: () => {
              this.resetMetadata(book)
            }
          },
          {
            label: this.$t('m.openMangaFileLocation'),
            onClick: () => {
              this.$refs.BookDetailDialogRef.showFile(book.filepath)
            }
          },
          {
            label: this.$t('m.moveFile'),
            onClick: () => {
              this.$refs.moveDlgRef.openMoveDialog(book)
            }
          },
          {
            label: this.$t('m.deleteFile'),
            onClick: () => {
              this.$refs.BookDetailDialogRef.deleteLocalBook(book)
            }
          },
          {
            label: this.$t('m.hideManga') + '/' + this.$t('m.showManga'),
            onClick: () => {
              this.$refs.BookDetailDialogRef.triggerHiddenBook(book)
            }
          },
          {
            label: this.$t('m.copyTagClipboard'),
            onClick: () => {
              this.copyTagClipboard(book)
            }
          },
          {
            label: this.$t('m.pasteTagClipboard'),
            onClick: () => {
              this.pasteTagClipboard(book)
            }
          },
          {
            label: this.$t('m.getMetadataFromClipboardLink'),
            onClick: () => {
              this.getMetadataFromClipboardLink(book)
            }
          },
          {
            label: this.$t('m.translateToChinese'),
            onClick: () => {
              this.translateBookToChinese(book)
            }
          },
          {
            label: this.$t('m.regenerateCover'),
            onClick: () => {
              this.regenerateBookCover(book)
            }
          },
          {
            label: this.$t('m.deleteCover'),
            onClick: async () => {
              try {
                await ipcRenderer.invoke('delete-cover', book.id)
                // 更新本地书籍数据，触发响应式更新
                book.coverPath = null
                this.printMessage('success', this.$t('m.coverDeleted'))
              } catch (e) {
                this.printMessage('error', `Delete cover failed: ${e.message}`)
              }
            }
          },
        ]
      })
    },

    // collection view function
    async loadCollectionList() {
      // avoid a collection with no list array
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
      // keep a cache mirror
      // await this.pushAppCache() // 函数不存在，暂时注释
    },
    openCollection(collection) {
      this.drawerVisibleCollection = true
      // avoid a collection with no list array
      const collectionSafe = Array.isArray(collection?.list) ? collection.list : []
      this.openCollectionBookList = _.compact(_.flatten(collectionSafe.list.map(hash_id => {
        return _.filter(this.bookList, book => book.id === hash_id || book.hash === hash_id)
      })))
      this.openCollectionTitle = collection.title
      this.$refs.EditViewRef.selectCollection = collection.id
    },
    editCurrentCollection() {
      this.drawerVisibleCollection = false
      this.$refs.EditViewRef.editCollectionView = true
      this.$refs.EditViewRef.handleSelectCollectionChange(this.$refs.EditViewRef.selectCollection)
    },
    previewManga(book) {
      this.$refs.InternalViewerRef.showThumbnail = true
      this.$refs.InternalViewerRef.viewManga(book, '83%')
    },

    // bookDetailView
    jumpMangeDetail(step) {
      const activeBookList = this.drawerVisibleCollection ? this.openCollectionBookList : _.filter(this.displayBookList, book => this.isBook(book) && this.isVisibleBook(book))
      const indexNow = _.findIndex(activeBookList, { id: this.bookDetail.id })
      const indexNext = indexNow + step
      if (indexNext >= 0 && indexNext < activeBookList.length) {
        this.$refs.BookDetailDialogRef.openBookDetail(activeBookList[indexNext])
      } else {
        this.printMessage('info', this.$t('c.outOfRange'))
      }
    },
    
    // 从历史记录打开书籍详情
    openBookDetailFromHistory(book) {
      // 记录打开详情
      if (this.$refs.BookHistoryButtonRef) {
        this.$refs.BookHistoryButtonRef.recordDetailOpen(book)
      }
      this.$refs.BookDetailDialogRef.openBookDetail(book)
    },
    
    // 记录详情打开
    recordDetailOpen(book) {
      if (this.$refs.BookHistoryButtonRef) {
        this.$refs.BookHistoryButtonRef.recordDetailOpen(book)
      }
    },
    jumpMangeDetailRandom() {
      const activeBookList = this.drawerVisibleCollection ? this.openCollectionBookList : _.filter(this.displayBookList, book => this.isBook(book) && this.isVisibleBook(book))
      this.$refs.BookDetailDialogRef.openBookDetail(_.sample(activeBookList))
    },
    openContentView(book) {
      this.$refs.InternalViewerRef.showThumbnail = false
      this.$refs.InternalViewerRef.viewManga(book)
    },
    openThumbnailView(book) {
      this.$refs.InternalViewerRef.showThumbnail = true
      this.$refs.InternalViewerRef.viewManga(book)
    },
    handleRemoveBookDisplay() {
      this.chunkDisplayBookList = this.customChunk(this.displayBookList, this.setting.pageSize, this.currentPage - 1)
    },

    // internal viewer
    toNextManga(step) {
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
    },
    toNextMangaRandom() {
      this.$refs.InternalViewerRef.handleStopReadManga()
      const activeBookList = this.drawerVisibleCollection ? this.openCollectionBookList : _.filter(this.displayBookList, book => this.isBook(book) && this.isVisibleBook(book))
      const selectBook = _.sample(activeBookList)
      setTimeout(() => {
        this.bookDetail = selectBook
        this.$refs.InternalViewerRef.viewManga(selectBook)
        this.comments = []
        if (this.setting.showComment) this.getComments(selectBook.url)
      }, 500)
    },
    isNoTag(book){
      return book.status === 'non-tag' || book.status === 'tag-failed';
    },
    isNoCategory(book){
      // 筛选出已标记为 tagged 但没有 category 的书籍
      return book.status === 'tagged' && (!book.category || book.category === '' || book.category === 'Misc');
    },
    // 优化筛选速度：使用SQL数据库查询代替内存过滤
    async filterBooksBySQLWrapper(filterType, bookList) {
      return await filterBooksBySQL(filterType, bookList, this.filterBooksByMemory)
    },

    // 内存过滤作为回退方案
    filterBooksByMemory(filterType, bookList) {
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
    },
  }
})

</script>
