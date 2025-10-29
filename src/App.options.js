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
import BookListGrid from './components/AppComponents/BookListGrid.vue'
import AppTopControls from './components/AppComponents/AppTopControls.vue'

import './App.styl'

import { mapWritableState, mapActions } from 'pinia'
import { useAppStore, toPlain } from './pinia.js'

import { useSearch } from './composables/useSearch.js'
import { useCollectTagMatch } from './composables/useCollectTagMatch.js'
import { useDuplicateGallery } from './composables/useDuplicateGallery.js'

// group method modules
import * as sorting from './appMethods/sorting.js'
import * as books from './appMethods/books.js'
import * as searching from './appMethods/searching.js'
import * as handlers from './appMethods/handlers.js'
import * as actions from './appMethods/actions.js'

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
    CollectionDrawer,
    BookListGrid,
    AppTopControls
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

      const groupedTags = {}
      processedTags.forEach(tag => {
        if (!groupedTags[tag.translatedCat]) {
          groupedTags[tag.translatedCat] = []
        }
        groupedTags[tag.translatedCat].push(tag)
      })

      Object.keys(groupedTags).forEach(cat => {
        groupedTags[cat].sort((a, b) => a.translatedTag.localeCompare(b.translatedTag))
      })

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
      this.recalculateCollectTagMatchCache(this.bookList, this.setting.collectTag)
      this.buildDuplicateCountCache()
    },
    'setting.collectTag': {
      handler() {
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

    // keep minimal methods that interact with children directly
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
    loadBookCardContent(id) {
      this.visibilityMap[id] = true
    },
    // externalized method groups
    ...sorting,
    ...books,
    ...searching,
    ...handlers,
    ...actions,
  }
})


