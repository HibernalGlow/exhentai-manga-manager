<template>
  <div class="book-card">
    <p class="book-title"
      @click="$emit('openBookDetail')"
      @contextmenu="onMangaTitleContextMenu($event, book)"
      :title="getDisplayTitle(book)"
    >{{getDisplayTitle(book)}}</p>
    <img
      class="book-cover"
      :src="book.coverPath"
      @error="onCoverError"
      @click="$emit('handleClickCover')"
      @contextmenu="$emit('onBookContextMenu', $event, book)"
    />
    <el-tag class="book-card-language" size="small"
      :type="isChineseTranslatedManga(book) ? 'danger' : 'info'"
      @click="$emit('handleSearchString', `:count=${book.readCount}`)"
    >{{book.readCount}}</el-tag>
    <el-tag class="book-card-pagecount" size="small" type="danger" v-if="book.pageDiff" @click="$emit('handleSearchString', 'pageDiff')">{{book.pageCount}}|{{book.filecount}}P</el-tag>
    <el-tag class="book-card-pagecount" size="small" type="info" v-else>{{ book.pageCount }}P</el-tag>
    <div v-if="setting.highlightCreatorTag" class="book-creator-tags">
      <el-tag
        v-for="tag in getCreatorTags(book)"
        :key="tag.category"
        class="book-creator-tag"
        size="small"
        :type="tag.type"
        effect="dark"
        @click="$emit('searchFromTag', tag.name, tag.category)"
      >{{ tag.letter }}:{{ tag.displayName }}</el-tag>
    </div>
    <el-icon
      :size="30"
      :color="book.mark ? '#E6A23C' : '#666666'"
      class="book-card-mark" @click="switchMark(book)"
    ><BookmarkTwotone /></el-icon>
    <div class="collect-tag">
      <el-tag
        v-for="tag in filterCollectTag(book.tags)" :key="tag.id"
        @click="$emit('searchFromTag', tag.tag, tag.cat)"
        @contextmenu.prevent="onTagContextMenu($event, tag)"
        :class="[
          'book-collect-tag',
          tag.isCollected ? 'collected-tag' : '',
          tag.isMixedMatch ? 'mixed-match-tag' : '',
          tag.isSearchMatch ? (tag.isCollected ? 'collected-search-match' : 'uncollected-search-match') : ''
        ]"
        :color="tag.color"
        size="small"
        effect="dark"
      >{{tag.letter}}:{{resolvedTranslation[tag.tag]?.name || tag.tag}}</el-tag>
    </div>
    <div>
      <el-button-group class="outer-read-button-group">
        <el-button type="success" size="small" class="outer-read-button" plain @click="$emit('openLocalBook')">{{$t('m.re')}}</el-button>
        <el-button type="success" size="small" class="outer-read-button" plain @click="$emit('viewManga')">{{$t('m.ad')}}</el-button>
      </el-button-group>
      <el-button-group v-if="setting.deleteMode" class="outer-delete-button-group">
        <el-button type="danger" size="small" class="outer-delete-button" plain @click="deleteBook(book)">{{$t('m.deleteFile')}}</el-button>
      </el-button-group>
      <el-tag
        class="book-status-tag"
        effect="plain"
        :type="book.status === 'non-tag' ? 'info' : book.status === 'tagged' ? 'success' : 'warning'"
        @click="book.category ? $emit('searchFromTag', book.category, 'cat') : $emit('searchFromTag', book.status)"
        :style="(book.category || '') === 'Missing' ?
          { backgroundColor: categoryColors.Missing, color: '#fff', border: '3px dashed currentColor' }
          : { backgroundColor: categoryColors[book.category] || '#272727' }"

      >{{ book.category || book.status }}
      </el-tag>
      <el-rate v-model="bookRating" size="small" allow-half @change="saveBook(Object.assign({}, book, {rating: bookRating}))"/>
    </div>
  </div>
</template>

<script setup>
import { ref, watchEffect, inject } from 'vue'
import { useI18n } from 'vue-i18n'
// import { ElMessageBox } from 'element-plus'
import { BookmarkTwotone } from '@vicons/material'
import ContextMenu from '@imengyu/vue3-context-menu'

import { storeToRefs } from 'pinia'
import { useAppStore } from '../pinia.js'
import { filterAndHighlightTags } from '../utils/tagFilter.js'
import { 
  showMangaTitleContextMenu, 
  showTagContextMenu,
  toggleCollectTag as toggleCollectTagUtil,
  generateAutoColor
} from '../utils/contextMenus.js'

const appStore = useAppStore()
const { setting, resolvedTranslation, cat2letter, bookList, displayBookList, collectionList, openCollectionBookList } = storeToRefs(appStore)
const { getDisplayTitle, isChineseTranslatedManga, saveBook, switchMark, printMessage } = appStore

const enableMixedGenderSearch = inject('enableMixedGenderSearch', () => false)

const { t } = useI18n()

const emit = defineEmits([
  'openBookDetail',
  'handleClickCover',
  'onBookContextMenu',
  'handleSearchString',
  'searchFromTag',
  'openLocalBook',
  'viewManga',
])

const props = defineProps({
  book: Object,
  searchString: String
})

const bookRating = ref(props.book.rating)

watchEffect(() => {
  bookRating.value = props.book.rating
})

const filterCollectTag = (tagObject) => {
  return filterAndHighlightTags({
    tagObject,
    collectTags: setting.value.collectTag || [],
    searchString: props.searchString,
    enableMixedGender: enableMixedGenderSearch(),
    cat2letter: cat2letter.value || {},
    showCollectTag: setting.value.showCollectTag
  })
}

// 获取所有创作者标签（artist、group、cosplayer）
const getCreatorTags = (book) => {
  if (!book.tags) return []
  
  const creatorTags = []
  const tagTypes = [
    { category: 'artist', type: 'danger', letter: 'a' },
    { category: 'group', type: 'warning', letter: 'g' },
    { category: 'cosplayer', type: 'info', letter: 'c' }
  ]
  
  for (const tagType of tagTypes) {
    const tags = book.tags[tagType.category]
    if (tags && tags.length > 0) {
      const tagName = tags[0]
      const displayName = resolvedTranslation.value[tagName]?.name || tagName
      creatorTags.push({
        name: tagName,
        displayName: displayName,
        category: tagType.category,
        type: tagType.type,
        letter: tagType.letter
      })
    }
  }
  
  return creatorTags
}

const onMangaTitleContextMenu = (e, book) => {
  showMangaTitleContextMenu({ e, book, t, ipcRenderer, ContextMenu })
}

// 封面加载错误处理：显示占位封面
const onCoverError = (event) => {
  const img = event.target
  // 使用占位封面
  img.src = '/placeholder-cover.svg'
  // 防止无限循环，如果占位封面也加载失败
  img.onerror = null
}

// 标签右键菜单：添加/移除收藏
const onTagContextMenu = (e, tag) => {
  showTagContextMenu({ 
    e, 
    tagName: tag.tag,
    category: tag.cat,
    isCollected: tag.isCollected,
    letter: tag.letter,
    book: props.book,
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
    Object.assign(book, {
      title: '',
      title_jpn: '',
      tags: {},
      status: 'non-tag',
      url: '',
      rating: 0,
      category: originalCategory, // 保留类别
    })
    
    // 保存书籍信息
    saveBook(book)
    
    // 显示成功消息
    printMessage('success', '已清空除类别外的所有元数据')
  }
}

// 删除书籍
const deleteBook = async (book) => {
  try {
    // 确认删除 - 默认不显示确认对话框，直接删除
    /*
    const confirmResult = await ElMessageBox.confirm(
      t('c.confirmDelete'),
      t('c.deleteFile'),
      {
        confirmButtonText: t('c.confirm'),
        cancelButtonText: t('c.cancel'),
        type: 'warning',
      }
    )
    
    if (confirmResult) {
    */
      // 执行删除
      await ipcRenderer.invoke('delete-local-book', book.filepath)
      
      // 从书籍列表中移除
      const findBookInBookList = bookList.value.findIndex(b => b.filepath === book.filepath)
      if (findBookInBookList !== -1) {
        bookList.value.splice(findBookInBookList, 1)
      }
      
      // 从显示列表中移除
      const findBookInDisplayList = displayBookList.value.findIndex(b => b.filepath === book.filepath)
      if (findBookInDisplayList !== -1) {
        displayBookList.value.splice(findBookInDisplayList, 1)
      }
      
      // 如果在合集中，也要从合集中移除
      if (book.collectionHide) {
        collectionList.value.forEach(collection => {
          collection.list = collection.list.filter(hash => hash !== book.id && hash !== book.hash)
        })
        openCollectionBookList.value = openCollectionBookList.value.filter(bookOfCollection => {
          return bookOfCollection.id !== book.id && bookOfCollection.id !== book.hash
        })
      }
      
      appStore.printMessage('success', t('c.deleteSuccess'))
    /*
    }
    */
  } catch (error) {
    console.error('删除书籍失败:', error)
    appStore.printMessage('error', t('c.deleteError'))
  }
}

// background color of the tag based on category, same color scheme as exhentai
const categoryColors = {
  'Doujinshi': '#9E2720',
  'Manga': '#DB6C24',
  'Artist CG': '#D38F1D',
  'Game CG': '#6A936D',
  'Western': '#AB9F60',
  'Non-H': '#5FA9CF',
  'Image Set': "#325CA2",
  "Cosplay": '#6A32A2',
  'Asian Porn': '#A23282',
  'Misc': '#777777',
  'Missing': '#20c5de',
}

</script>

<style lang="stylus">
.book-card
  display: inline-block
  width: 220px
  min-height: 365px
  padding-bottom: 4px
  border: solid 1px var(--el-border-color)
  border-radius: 4px
  margin: 6px 6px
  position: relative
  .collect-tag
    overflow-x: hidden
    margin: 0 0 0 10px
    text-align: left
    .book-collect-tag
      cursor: pointer
      margin-right: 4px
      margin-bottom: 4px
      border-width: 0
      padding-left: 4px
      padding-right: 4px
    .collected-tag
      border: 1px solid currentColor !important
      opacity: 0.85
      font-weight: 600
    .mixed-match-tag
      border: 2px dashed currentColor !important
      opacity: 0.9
      box-shadow: 0 0 0 1px currentColor
    .collected-search-match
      border: 3px solid #409EFF !important
      opacity: 0.95
      box-shadow: 0 0 6px rgba(64, 158, 255, 0.4)
    .uncollected-search-match
      border: 3px solid #A855F7 !important
      opacity: 0.95
      box-shadow: 0 0 6px rgba(168, 85, 247, 0.4)
      opacity: 0.95
      box-shadow: 0 0 6px rgba(103, 194, 58, 0.6)
      animation: search-highlight-pulse 2s ease-in-out infinite
    .search-only-tag
      border: 3px dotted #67C23A !important
      opacity: 0.95
      box-shadow: 0 0 4px rgba(103, 194, 58, 0.5)
.book-title
  height: 36px
  overflow-y: hidden
  margin: 8px 6px
  font-size: 14px
  cursor: pointer
  line-height: 18px
.book-card-mark, .book-card-language, .book-card-pagecount
  position: absolute
  cursor: pointer
.book-card-language
  left: 10px
  top: 52px
  border-radius: 3px 0 3px 0
.book-card-pagecount
  left: 10px
  top: 315px
  border-radius: 0 3px 0 3px
.book-creator-tags
  position: absolute
  right: 10px
  top: 292px
  display: flex
  flex-direction: column
  align-items: flex-end
  gap: 2px
  z-index: 1
  .book-creator-tag
    cursor: pointer
    font-weight: bold
    font-size: 12px
    padding: 2px 6px
    border-radius: 3px 0 3px 0
    max-width: 180px
    overflow: hidden
    text-overflow: ellipsis
    white-space: nowrap
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3)
.book-card-mark
  right: 4px
  top: 40px
.book-cover
  border-radius: 4px
  width: 200px
  height: 283px
  object-fit: cover
.outer-read-button-group
  margin: 0 6px
.outer-read-button:first-child
  padding: 0 0 0 6px
.outer-read-button + .outer-read-button
  padding: 0 6px 0 0
.book-status-tag
  padding: 0 2px
  margin-right: 6px
  cursor: pointer
  width: 90px
  color: #f1f1f1
  font-weight: bold
  font-size: 12px
.el-rate
  display: inline-block
  height: 18px
.el-rate__icon
  width: 12px

@keyframes search-highlight-pulse
  0%, 100%
    box-shadow: 0 0 6px rgba(103, 194, 58, 0.6)
  50%
    box-shadow: 0 0 12px rgba(103, 194, 58, 0.8), 0 0 18px rgba(103, 194, 58, 0.4)
</style>