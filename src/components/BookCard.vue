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
      @click="$emit('handleClickCover')"
      @contextmenu="$emit('onBookContextMenu', $event, book)"
    />
    <el-tag class="book-card-language" size="small"
      :type="isChineseTranslatedManga(book) ? 'danger' : 'info'"
      @click="$emit('handleSearchString', `:count=${book.readCount}`)"
    >{{book.readCount}}</el-tag>
    <el-tag class="book-card-pagecount" size="small" type="danger" v-if="book.pageDiff" @click="$emit('handleSearchString', 'pageDiff')">{{book.pageCount}}|{{book.filecount}}P</el-tag>
    <el-tag class="book-card-pagecount" size="small" type="info" v-else>{{ book.pageCount }}P</el-tag>
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
const appStore = useAppStore()
const { setting, resolvedTranslation, cat2letter, bookList, displayBookList, collectionList, openCollectionBookList } = storeToRefs(appStore)
const { getDisplayTitle, isChineseTranslatedManga, saveBook, switchMark } = appStore

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

const onMangaTitleContextMenu = (e, book) => {
  e.preventDefault()
  ContextMenu.showContextMenu({
    x: e.x,
    y: e.y,
    items: [
      {
        label: t('c.copyTitleToClipboard'),
        onClick: () => {
          ipcRenderer.invoke('copy-text-to-clipboard', book.title_jpn || book.title)
        }
      },
      {
        label: t('c.copyLinkToClipboard'),
        onClick: () => {
          ipcRenderer.invoke('copy-text-to-clipboard', book.url)
        }
      },
      {
        label: t('c.copyTitleAndLinkToClipboard'),
        onClick: () => {
          ipcRenderer.invoke('copy-text-to-clipboard', `${book.title_jpn || book.title}\n${book.url}\n`)
        }
      },
    ]
  })
}

// 标签右键菜单：添加/移除收藏
const onTagContextMenu = (e, tag) => {
  e.preventDefault()
  
  ContextMenu.showContextMenu({
    x: e.x,
    y: e.y,
    items: [
      {
        label: tag.isCollected ? '取消收藏此标签' : '收藏此标签',
        onClick: () => {
          toggleCollectTag(tag)
        }
      },
      {
        label: t('c.copyTitleToClipboard'),
        onClick: () => {
          ipcRenderer.invoke('copy-text-to-clipboard', tag.tag)
        }
      }
    ]
  })
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

// 切换标签收藏状态
const toggleCollectTag = (tag) => {
  if (!setting.value.collectTag) {
    setting.value.collectTag = []
  }
  
  if (tag.isCollected) {
    // 移除收藏
    setting.value.collectTag = setting.value.collectTag.filter(
      t => !(t.cat === tag.cat && t.tag === tag.tag)
    )
    appStore.printMessage('success', '已取消收藏')
  } else {
    // 添加收藏
    const newTag = {
      cat: tag.cat,
      tag: tag.tag,
      letter: tag.letter,
      color: generateAutoColor(tag.cat) // 使用自动生成的颜色
    }
    setting.value.collectTag.push(newTag)
    appStore.printMessage('success', '已添加到收藏')
  }
  
  // 保存设置
  ipcRenderer.invoke('save-setting', setting.value)
}

// 根据类别自动生成颜色
const generateAutoColor = (category) => {
  const categoryColors = {
    'female': '#FF6B9D',      // 粉红色
    'male': '#4A9EFF',        // 蓝色
    'mixed': '#9D5CFF',       // 紫色
    'artist': '#FF9F40',      // 橙色
    'group': '#20C5DE',       // 青色
    'parody': '#67C23A',      // 绿色
    'character': '#F56C6C',   // 红色
    'language': '#909399',    // 灰色
    'cosplayer': '#E6A23C',   // 金色
    'other': '#606266'        // 深灰色
  }
  
  return categoryColors[category] || '#409EFF' // 默认蓝色
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