<template>
  <el-dialog v-model="dialogVisibleBookDetail"
    fullscreen
    class="dialog-detail"
  >
    <template #header>
      <p class="detail-book-title">
        <span class="url-link" @click="openUrl(bookDetail.url)" @contextmenu="onMangaTitleContextMenu($event, bookDetail)">{{getDisplayTitle(bookDetail)}}</span>
      </p>
    </template>
    <el-row :gutter="20" class="book-detail-card">
      <el-col :span="6">
        <el-row class="book-detail-function book-detail-cover-frame">
          <img
            class="book-detail-cover"
            :src="bookDetail.coverPath"
            @click="$emit('openContentView', bookDetail)"
            @contextmenu="$emit('openThumbnailView', bookDetail)"
          />
          <el-icon
            :size="30"
            :color="bookDetail.mark ? '#E6A23C' : '#666666'"
            class="book-detail-star" @click="switchMark(bookDetail)"
          ><BookmarkTwotone /></el-icon>
          <div class="next-manga-pane" @click="$emit('jumpMangeDetail', 1)"><el-icon text><CaretRight20Regular /></el-icon></div>
          <div class="prev-manga-pane" @click="$emit('jumpMangeDetail', -1)"><el-icon text><CaretLeft20Regular /></el-icon></div>
        </el-row>
        <el-row :gutter="20" class="book-detail-rate">
          <el-rate v-model="bookDetail.rating" size="large" allow-half @change="saveBook(bookDetail)"/>
        </el-row>
        <el-row class="book-detail-function">
          <el-descriptions :column="1">
            <el-descriptions-item :label="$t('m.pageCount')+':'" :class-name="bookDetail.pageDiff ? 'text-red' : ''">
              {{bookDetail.pageCount}} | {{bookDetail.filecount}}
            </el-descriptions-item>
            <el-descriptions-item :label="$t('m.fileSize')+':'">
              {{Math.floor(bookDetail.bundleSize / 1048576)}} | {{Math.floor(bookDetail.filesize / 1048576)}} MB
            </el-descriptions-item>
            <el-descriptions-item :label="$t('m.readCount')+':'">{{bookDetail.readCount}}</el-descriptions-item>
            <el-descriptions-item :label="$t('m.mtime')+':'">{{new Date(bookDetail.mtime).toLocaleString("zh-CN")}}</el-descriptions-item>
            <el-descriptions-item :label="$t('m.postTime')+':'">{{new Date(bookDetail.posted * 1000).toLocaleString("zh-CN")}}</el-descriptions-item>
          </el-descriptions>
        </el-row>
        <el-row class="book-detail-function">
          <el-button-group style="margin-right: 12px;">
            <el-button type="success" style="padding-right: 0;" plain @click="openLocalBook(bookDetail)">{{$t('m.re')}}</el-button>
            <el-button type="success" style="padding-left: 0;" plain @click="$emit('openContentView', bookDetail)">{{$t('m.ad')}}</el-button>
          </el-button-group>
          <el-button plain @click="triggerShowComment">{{setting.showComment ? $t('m.hideComment') : $t('m.showComment')}}</el-button>
          <el-button type="primary" plain @click="editTags">{{editingTag ? $t('m.showTag') : $t('m.editTag')}}</el-button>
        </el-row>
        <el-row class="book-detail-function">
          <el-button type="primary" plain  @click="$emit('openSearchDialog')">{{$t('m.getMetadata')}}</el-button>
          <el-button type="primary" plain @click="triggerHiddenBook(bookDetail)">
            {{bookDetail.hiddenBook ? $t('m.showManga') : $t('m.hideManga')}}
          </el-button>
        </el-row>
        <el-row class="book-detail-function">
          <el-button type="danger" plain @click="deleteLocalBook(bookDetail)">{{$t('m.deleteFile')}}</el-button>
          <el-button plain @click="rescanBook(bookDetail)">{{$t('m.rescan')}}</el-button>
          <el-button type="primary" plain @click="showFile(bookDetail.filepath)">{{$t('m.openMangaFileLocation')}}</el-button>
          <el-button type="warning" plain @click="resetMetadata(bookDetail)">{{$t('m.resetMetadata')}}</el-button>
        </el-row>
      </el-col>
      <el-col :span="setting.showComment ? 10 : 18">
        <el-scrollbar class="book-tag-frame">
          <div v-if="editingTag">
            <div class="edit-line">
              <el-input v-model="bookDetail.title_jpn" :placeholder="$t('m.title')" @change="saveBook(bookDetail)"></el-input>
            </div>
            <div class="edit-line">
              <el-input v-model="bookDetail.title" :placeholder="$t('m.englishTitle')" @change="saveBook(bookDetail)"></el-input>
            </div>
            <div class="edit-line">
              <el-select v-model="bookDetail.status" :placeholder="$t('m.metadataStatus')" @change="saveBook(bookDetail)">
                <el-option v-for="status in statusOption" :value="status" :key="status" :label="status" />
              </el-select>
            </div>
            <div class="edit-line">
              <el-input v-model="bookDetail.url" :placeholder="$t('m.ehexAddress')" @change="saveBook(bookDetail)"></el-input>
            </div>
            <div class="edit-line">
              <el-select v-model="bookDetail.category" :placeholder="$t('m.category')" @change="saveBook(bookDetail)" clearable>
                <el-option v-for="cat in categoryOption" :value="cat" :key="cat" :label="cat" />
              </el-select>
            </div>
            <div class="edit-line" v-for="(arr, key) in tagGroup" :key="key">
              <el-select-v2
                v-model="bookDetail.tags[key]" :placeholder="key" @change="saveBookTags(bookDetail)"
                filterable clearable allow-create multiple :reserve-keyword="false" :height="340"
                :options="arr"
              >
              </el-select-v2>
            </div>
            <el-space wrap class="tag-edit-buttons">
              <el-button @click="addTagCat">{{$t('m.addCategory')}}</el-button>
              <el-button @click="$emit('getBookInfo')">{{$t('m.getTagbyUrl')}}</el-button>
              <el-button @click="resetMetadata(bookDetail)">{{$t('m.resetMetadata')}}</el-button>
              <el-button @click="copyTagClipboard(bookDetail)">{{$t('m.copyTagClipboard')}}</el-button>
              <el-button @click="pasteTagClipboard(bookDetail)">{{$t('m.pasteTagClipboard')}}</el-button>
            </el-space>
          </div>
          <div v-else>
            <el-descriptions :column="1">
              <el-descriptions-item :label="$t('m.title')+':'">{{bookDetail.title_jpn}}</el-descriptions-item>
              <el-descriptions-item :label="$t('m.englishTitle')+':'">{{bookDetail.title}}</el-descriptions-item>
              <el-descriptions-item :label="$t('m.filename')+':'">{{returnFileNameWithExt(bookDetail.filepath)}}</el-descriptions-item>
              <el-descriptions-item :label="$t('m.fileLocation')+':'">{{returnDirname(bookDetail.filepath)}}</el-descriptions-item>
              <el-descriptions-item :label="$t('m.category')+':'">
                <el-tag type="info" class="book-tag" @click="$emit('searchFromTag', bookDetail.category, 'cat')">
                  {{bookDetail.category}}</el-tag>
              </el-descriptions-item>
              <el-descriptions-item v-for="(tagArr, key) in bookDetail.tags" :label="key + ':'" :key="key">
                <el-popover
                  effect="dark"
                  trigger="hover"
                  :content="resolvedTranslation[tag.tag || tag] ? resolvedTranslation[tag.tag || tag].intro : (tag.tag || tag)"
                  :disabled="!resolvedTranslation[tag.tag || tag]?.intro"
                  placement="top-start"
                  :show-after="500"
                  width="300px"
                  v-for="tag in getHighlightedTags(tagArr, key)" :key="tag.id || tag"
                >
                  <template #reference>
                    <el-tag
                      type="info"
                      :class="[
                        'book-tag',
                        tag.isCollected ? 'collected-tag' : '',
                        tag.isMixedMatch ? 'mixed-match-tag' : '',
                        tag.isSearchMatch ? (tag.isCollected ? 'collected-search-match' : 'uncollected-search-match') : ''
                      ]"
                      :color="tag.color"
                      effect="dark"
                      @click="$emit('searchFromTag', tag.tag || tag, key)"
                      @contextmenu.prevent="onTagContextMenu($event, tag.tag || tag, key, tag.isCollected)"
                    >{{resolvedTranslation[tag.tag || tag] ? resolvedTranslation[tag.tag || tag].name : (tag.tag || tag) }}</el-tag>
                  </template>
                </el-popover>
              </el-descriptions-item>
            </el-descriptions>
          </div>
        </el-scrollbar>
      </el-col>
      <el-col :span="8" v-if="setting.showComment">
        <el-scrollbar class="book-comment-frame">
          <div class="book-comment" v-for="comment in comments" :key="comment.id">
            <div class="book-comment-postby">{{comment.author}}<span class="book-comment-score">{{comment.score}}</span></div>
            <p class="book-comment-content" @contextmenu="onMangaCommentContextMenu($event, comment)">{{comment.content}}</p>
          </div>
        </el-scrollbar>
      </el-col>
    </el-row>
  </el-dialog>
</template>

<script setup>
import { ref, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessageBox } from 'element-plus'
import { CaretRight20Regular, CaretLeft20Regular } from '@vicons/fluent'
import { BookmarkTwotone } from '@vicons/material'
import { nanoid } from 'nanoid'
import he from 'he'
import * as linkify from 'linkifyjs'
import ContextMenu from '@imengyu/vue3-context-menu'
import { storeToRefs } from 'pinia'
import { useAppStore } from '../pinia.js'
import  { insertLocalReadRecord } from '../utils.js'
import { filterAndHighlightTags } from '../utils/tagFilter.js'
import { 
  showMangaTitleContextMenu, 
  showTagContextMenu,
  toggleCollectTag as toggleCollectTagUtil,
  generateAutoColor
} from '../utils/contextMenus.js'

const dialogVisibleBookDetail = ref(false)

const enableMixedGenderSearch = inject('enableMixedGenderSearch', () => false)


const appStore = useAppStore()
const {
  setting, bookDetail, resolvedTranslation, cat2letter,
  bookList, displayBookList, collectionList, openCollectionBookList,
  statusOption, categoryOption,
  pathSep,
} = storeToRefs(appStore)
const {
  printMessage,
  saveBook,
  returnFileNameWithExt,
  getDisplayTitle,
  resetMetadata,
  switchMark,
  copyTagClipboard,
  pasteTagClipboard,
} = appStore

const { t } = useI18n()

const emit = defineEmits([
  'openContentView',
  'openThumbnailView',
  'saveCollection',
  'handleRemoveBookDisplay',
  'openSearchDialog',
  'getBookInfo',
  'searchFromTag',
  'jumpMangeDetail',
])

const props = defineProps({
  searchString: {
    type: String,
    default: ''
  }
})

// 获取高亮标签的函数
const getHighlightedTags = (tagArr, category) => {
  if (!tagArr || tagArr.length === 0) return []
  
  // 如果setting.showCollectTag为false，直接返回原始标签数组
  if (!setting.value.showCollectTag) {
    return tagArr
  }
  
  // 将标签数组转换为tagObject格式，便于filterAndHighlightTags处理
  const tagObject = { [category]: tagArr }
  
  // 使用filterAndHighlightTags获取高亮信息
  const highlightedTags = filterAndHighlightTags({
    tagObject,
    collectTags: setting.value.collectTag || [],
    searchString: props.searchString,
    enableMixedGender: enableMixedGenderSearch(),
    cat2letter: cat2letter.value || {},
    showCollectTag: true
  })
  
  // 创建一个Map来存储高亮信息
  const highlightMap = new Map()
  highlightedTags.forEach(tag => {
    highlightMap.set(tag.tag, tag)
  })
  
  // 合并原始标签和高亮信息
  return tagArr.map(tag => {
    const highlightInfo = highlightMap.get(tag)
    if (highlightInfo) {
      return highlightInfo
    }
    // 如果没有高亮信息，返回原始标签字符串
    return tag
  })
}


const openBookDetail = (book) => {
  bookDetail.value = book
  dialogVisibleBookDetail.value = true
  comments.value = []
  if (setting.value.showComment) getComments(book.url)
}
const openUrl = (url) => {
  ipcRenderer.invoke('open-url', url)
}
const triggerHiddenBook = async (book) => {
  book.hiddenBook = !book.hiddenBook
  await saveBook(book)
}


const returnDirname = (filepath) => {
  return filepath.split(/[/\\]/).slice(0, -1).join(pathSep.value)
}

const showFile = (filepath) => {
  ipcRenderer.invoke('show-file', filepath)
}
const openLocalBook = (book) => {
  bookDetail.value = book
  if (setting.value.imageExplorer) {
    bookDetail.value.readCount += 1
    saveBook(bookDetail.value)
    ipcRenderer.invoke('open-local-book', bookDetail.value.filepath)
  } else {
    emit('openContentView', book)
  }
  insertLocalReadRecord(book.id)
}
const rescanBook = async (book) => {
  const bookInfo = await ipcRenderer.invoke('patch-local-metadata-by-book', _.cloneDeep(book))
  _.assign(book, bookInfo)
  await saveBook(book)
  printMessage('success', t('c.rescanSuccess'))
}
const deleteBook = async (book) => {
  await ipcRenderer.invoke('delete-local-book', book.filepath)
  .finally(() => {
    dialogVisibleBookDetail.value = false
    if (book.collectionHide) {
      _.forEach(collectionList.value, (collection) => {
        collection.list = _.filter(collection.list, hash_id => hash_id !== book.id && hash_id !== book.hash)
      })
      openCollectionBookList.value = _.filter(openCollectionBookList.value, bookOfCollection => {
        return bookOfCollection.id !== book.id && bookOfCollection.id !== book.hash
      })
      emit('saveCollection')
    } else {
      const findBookInBookList = _.findIndex(bookList.value, b => b.filepath === book.filepath)
      bookList.value.splice(findBookInBookList, 1)
      displayBookList.value = _.filter(displayBookList.value, b => b.filepath !== book.filepath)
      emit('handleRemoveBookDisplay')
    }
  })
}
const deleteLocalBook = (book) => {
  if (setting.value.skipDeleteConfirm) {
    deleteBook(book)
  } else {
    ElMessageBox.confirm(
      t('c.confirmDelete'),
      '',
      {}
    )
    .then(() => deleteBook(book))
  }
}

const comments = ref([])
const triggerShowComment = () => {
  if (setting.value.showComment) {
    setting.value.showComment = false
  } else {
    comments.value = []
    getComments(bookDetail.value.url)
    setting.value.showComment = true
  }
}
const getComments = (url) => {
  if (url) {
    ipcRenderer.invoke('get-ex-webpage', {
      url,
      cookie: appStore.cookie
    })
    .then(res => {
      comments.value = []
      const commentElements = new DOMParser().parseFromString(res, 'text/html').querySelectorAll('#cdiv>.c1')
      commentElements.forEach(e => {
        const author = e.querySelector('.c2 .c3').textContent
        const scoreTail = e.querySelectorAll('.c2 .nosel')
        const score = scoreTail[scoreTail.length - 1].textContent
        let content = e.querySelector('.c6').innerHTML
        const foundLink = _.uniqBy(linkify.find(content.replace(/[<"]/gi, ' '), 'url'), 'href')
        content = content.replace(/<br>/gi, '\n')
        content = content.replace(/<.+?>/gi, '')
        content = he.decode(content)
        comments.value.push({
          author, score, content, id: nanoid(), foundLink
        })
      })
    })
    .catch(err => {
      comments.value = []
      console.log(err)
    })
  } else {
    comments.value = []
  }
}

const editingTag = ref(false)
const tagGroup = ref({})
const tagSortKey = ['language', 'parody', 'character', 'group', 'artist', 'male', 'female', 'mixed', 'other', 'cosplayer']
const editTags = () => {
  editingTag.value = !editingTag.value
  if (editingTag.value) {
    // ensure tags is a plain object
    if (!_.isPlainObject(bookDetail.value?.tags)) {
      bookDetail.value.tags = {}
    }
    // Initialize tagGroup for easier manual tag editing
    for (const cat of tagSortKey) {
      if (!Array.isArray(bookDetail.value.tags[cat])) {
        bookDetail.value.tags[cat] = []
      }
    }
    const tempTagGroup = {}
    _.forEach(bookList.value.map(b => b.tags), (tagObject) => {
      _.forIn(tagObject, (tagArray, tagCat) => {
        if (_.isArray(tagArray)) {
          if (_.has(tempTagGroup, tagCat)) {
            tagArray.forEach(tag => tempTagGroup[tagCat].add(tag))
          } else {
            tempTagGroup[tagCat] = new Set(tagArray)
          }
        }
      })
    })
    const showTranslation = setting.value.showTranslation
    _.forIn(tempTagGroup, (tagSet, tagCat) => {
      tempTagGroup[tagCat] = [...tagSet].sort().map(tag => ({
        value: tag,
        label: `${showTranslation ? (resolvedTranslation.value[tag]?.name || tag) + ' || ' : ''}${tag}`,
      }))
    })
    tagGroup.value = tempTagGroup
  } else {
    saveBookTags(bookDetail.value)
  }
}
const saveBookTags = (book) => {
  const compactTags = {}
  _.forIn(book.tags, (tagarr, tagCat) => {
    if (!_.isEmpty(tagarr)) {
      compactTags[tagCat] = tagarr
    }
  })
  const sortedTags = {}
  tagSortKey.forEach(tagCat => {
    if (compactTags[tagCat]) {
      sortedTags[tagCat] = compactTags[tagCat]
    }
  })
  book.tags = Object.assign(sortedTags, compactTags)
  saveBook(book)
}
const addTagCat = () => {
  ElMessageBox.prompt(t('c.inputCategoryName'), t('m.addCategory'), {
    inputPattern: /^[\p{L}\d_]+$/u,
    inputErrorMessage: t('c.categoryNameError')
  })
  .then(({ value }) => {
    tagGroup.value[value] = []
  })
  .catch(() => {
    printMessage('info', t('c.canceled'))
  })
}


const onMangaTitleContextMenu = (e, book) => {
  showMangaTitleContextMenu({ e, book, t, ipcRenderer, ContextMenu })
}

const onMangaCommentContextMenu = (e, comment) => {
  e.preventDefault()
  const foundLink = comment.foundLink
  if (!_.isEmpty(foundLink)) {
    const items = foundLink.map(l => ({
      label: `${t('c.redirect')} ${l.href}`,
      onClick: () => {
        ipcRenderer.invoke('open-url', l.href)
      }
    }))
    ContextMenu.showContextMenu({
      x: e.x,
      y: e.y,
      items
    })
  }
}

// 标签右键菜单：添加/移除收藏
const onTagContextMenu = (e, tagName, category, isCollected) => {
  const letter = cat2letter.value[category] || category.charAt(0)
  
  showTagContextMenu({
    e,
    tagName,
    category,
    isCollected,
    letter,
    book: bookDetail.value,
    t,
    ipcRenderer,
    ContextMenu,
    onToggleCollect: toggleCollectTag,
    onRemoveTag: removeTagFromBook,
    onClearMetadata: clearMetadataExceptCategory
  })
}

// 切换标签收藏状态
const toggleCollectTag = (tagName, category, letter, isCollected) => {
  toggleCollectTagUtil({
    tagName,
    category,
    letter,
    isCollected,
    setting: setting.value,
    ipcRenderer,
    printMessage,
    generateAutoColor
  })
}

// 从本书元数据中删除标签
const removeTagFromBook = (tagName, category, book) => {
  if (book && book.tags && book.tags[category]) {
    // 从标签数组中移除指定的标签
    book.tags[category] = book.tags[category].filter(tag => tag !== tagName)
    
    // 保存书籍信息
    saveBook(book)
    
    // 显示成功消息
    printMessage('success', `已从本书中删除标签: ${tagName}`)
  }
}

// 清空除类别外元数据
const clearMetadataExceptCategory = (book) => {
  if (book) {
    // 保存类别信息
    const originalCategory = book.category
    
    // 清空所有元数据字段，但保留必要的系统字段
    const clearedBook = {
      ...book,
      title: '',
      title_jpn: '',
      tags: {},
      status: 'non-tag',
      url: '',
      rating: 0,
      // 保留类别
      category: originalCategory,
      // 保留系统字段
      filepath: book.filepath,
      id: book.id,
      hash: book.hash,
      coverPath: book.coverPath,
      pageCount: book.pageCount,
      filecount: book.filecount,
      bundleSize: book.bundleSize,
      filesize: book.filesize,
      mtime: book.mtime,
      date: book.date,
      posted: book.posted,
      readCount: book.readCount,
      hiddenBook: book.hiddenBook,
      mark: book.mark,
      collectionHide: book.collectionHide
    }
    
    // 更新书籍详情
    Object.assign(book, clearedBook)
    
    // 保存书籍信息
    saveBook(book)
    
    // 显示成功消息
    printMessage('success', '已清空除类别外的所有元数据')
  }
}

defineExpose({
  dialogVisibleBookDetail,
  editingTag,
  openBookDetail,
  openLocalBook,
  rescanBook,
  getComments,
  showFile,
  deleteLocalBook,
  triggerHiddenBook
})

</script>

<style lang="stylus">
.el-dialog.is-fullscreen.dialog-detail
  .el-dialog__header
    .el-dialog__headerbtn
      margin: 8px 16px 0 0
      .el-icon
        width: 32px
        svg
          height: 32px
          width: 32px

.text-red
  color: red !important

.detail-book-title
  height: 44px
  overflow-y: hidden
  margin: 0 24px
.url-link
  cursor: pointer
.book-detail-card
  .book-detail-function, .book-detail-rate
    justify-content: center
    margin-bottom: 10px
  .book-detail-cover-frame
    position: relative
    width: 250px
    margin: 0 auto
    margin-bottom: 10px
    .book-detail-cover
      width: 250px
      height: 354px
      object-fit: cover
      border-radius: 4px
    .next-manga-pane, .prev-manga-pane
      position: absolute
      bottom: 80px
      cursor: pointer
      opacity: 0
      transition-delay: 0.5s
      background-color: rgba(0, 0, 0, 0.3)
      .el-icon
        font-size: 34px
        margin: 80px 0
        color: #FFFFFF
    .next-manga-pane
      right: 0
      border-radius: 4px 0 0 4px
    .prev-manga-pane
      left: 0
      border-radius: 0 4px 4px 0
    .next-manga-pane:hover, .prev-manga-pane:hover
      opacity: 1
      transition-delay: 0s
    .book-detail-star
      position: absolute
      cursor: pointer
      right: -6px
      top: -14px
  .edit-line
    margin: 4px 0
    .el-select, .el-select-v2
      width: 100%
  .el-descriptions__label
    display: inline-block
    text-align: right
    width: 80px
.book-tag-edit-popover
  .el-descriptions__cell
    padding-bottom: 0 !important
  .el-descriptions__label
    display: inline-block
    text-align: right
    width: 65px
.book-tag-frame
  height: calc(100vh - 100px)
  overflow-y: auto
  padding-right: 10px
  text-align: left
.book-tag
  margin: 4px 6px
  cursor: pointer
  // 收藏标签样式
  &.collected-tag
    border: 1px solid currentColor !important
    opacity: 0.85
    font-weight: 600
  // 混合性别匹配标签样式
  &.mixed-match-tag
    border: 2px dashed currentColor !important
    opacity: 0.9
    box-shadow: 0 0 0 1px currentColor
  // 搜索匹配的收藏标签
  &.collected-search-match
    border: 3px solid #409EFF !important
    opacity: 0.95
    box-shadow: 0 0 6px rgba(64, 158, 255, 0.4)
  // 搜索匹配的非收藏标签
  &.uncollected-search-match
    border: 3px solid #A855F7 !important
    opacity: 0.95
    box-shadow: 0 0 6px rgba(168, 85, 247, 0.4)

.tag-edit-buttons
  margin-top: 4px
.book-comment-frame
  text-align: left
  height: calc(100vh - 100px)
  overflow-y: auto
  padding-right: 10px
  .book-comment
    .book-comment-postby
      font-size: 12px
      background-color: var(--el-fill-color-dark)
      padding-left: 4px
      color: var(--el-text-color-regular)
    .book-comment-score
      float: right
      margin-right: 4px
    .book-comment-content
      font-size: 14px
      white-space: pre-wrap
      padding-left: 4px
      color: var(--el-text-color-regular)
</style>