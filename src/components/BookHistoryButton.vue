<template>
  <el-tooltip content="书籍历史记录" placement="top">
    <el-button
        type="primary"
        plain
        :icon="Clock"
        @click="showBookHistory"
        title="书籍历史记录"
    />
  </el-tooltip>

  <!-- 书籍历史记录侧边栏 -->
  <el-drawer 
    v-model="sideVisibleBookHistory"
    :title="$t('m.bookHistory')"
    direction="rtl"
    :size="setting.bookHistoryWidth ? setting.bookHistoryWidth : '30%'"
    modal-class="side-history-modal"
    @close="closeBookHistory"
  >
    <el-tabs v-model="activeHistoryTab" class="history-tabs">
      <!-- 阅读次数记录 -->
      <el-tab-pane label="阅读次数" name="readCount">
        <div class="history-content">
          <el-empty v-if="readCountList.length === 0" description="暂无阅读记录" />
          <div v-else class="history-list">
            <div
              v-for="(item, index) in readCountList"
              :key="item.id"
              class="history-item"
              @click="openBookFromHistory(item)"
            >
              <div class="history-item-index">{{ index + 1 }}</div>
              <img
                :src="item.coverPath"
                class="history-item-cover"
                @error="onCoverError"
              />
              <div class="history-item-info">
                <div class="history-item-title">{{ getDisplayTitle(item) }}</div>
                <div class="history-item-time">
                  阅读次数: {{ item.readCount || 0 }}
                </div>
                <div class="history-item-meta">
                  {{ item.pageCount }}页
                </div>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>
      
      <!-- 打开详情记录 -->
      <el-tab-pane label="打开详情" name="detailOpen">
        <div class="history-content">
          <el-empty v-if="detailOpenList.length === 0" description="暂无详情打开记录" />
          <div v-else class="history-list">
            <div
              v-for="(item, index) in detailOpenList"
              :key="item.id"
              class="history-item"
              @click="openBookFromHistory(item)"
            >
              <div class="history-item-index">{{ index + 1 }}</div>
              <img
                :src="item.coverPath"
                class="history-item-cover"
                @error="onCoverError"
              />
              <div class="history-item-info">
                <div class="history-item-title">{{ getDisplayTitle(item) }}</div>
                <div class="history-item-time">
                  打开时间: {{ formatReadTime(item.open_time) }}
                </div>
                <div class="history-item-meta">
                  {{ item.pageCount }}页
                </div>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </el-drawer>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Clock } from '@element-plus/icons-vue'
import { fetchRecentReads } from '../utils.js'

const props = defineProps({
  bookList: {
    type: Array,
    default: () => []
  },
  setting: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['open-book-detail'])

const sideVisibleBookHistory = ref(false)
const activeHistoryTab = ref('readCount')
const detailHistoryUpdateTrigger = ref(0) // 用于强制更新详情列表

// 显示书籍历史记录
const showBookHistory = () => {
  sideVisibleBookHistory.value = true
}

// 关闭历史记录侧边栏
const closeBookHistory = () => {
  sideVisibleBookHistory.value = false
}

// 从历史记录打开书籍
const openBookFromHistory = (book) => {
  emit('open-book-detail', book)
  closeBookHistory()
}

// 获取显示标题
const getDisplayTitle = (book) => {
  return book.title_jpn || book.title || 'Untitled'
}

// 格式化阅读时间
const formatReadTime = (timestamp) => {
  if (!timestamp) return '未知'
  const date = new Date(timestamp * 1000)
  return date.toLocaleString('zh-CN')
}

// 封面加载错误处理
const onCoverError = (event) => {
  const img = event.target
  img.src = '/placeholder-cover.svg'
  img.onerror = null
}

// 阅读次数列表 - 按readCount降序排列
const readCountList = computed(() => {
  return props.bookList
    .filter(book => !book.isCollection && book.readCount > 0)
    .sort((a, b) => (b.readCount || 0) - (a.readCount || 0))
    .slice(0, 100) // 最多显示100条
})

// 打开详情记录列表
const detailOpenList = computed(() => {
  // 添加依赖项，确保能响应更新
  detailHistoryUpdateTrigger.value
  
  const detailOpenHist = JSON.parse(localStorage.getItem('detailOpenHistory') || '[]')
  const historyBooks = []
  
  detailOpenHist.forEach(record => {
    const book = props.bookList.find(b => b.id === record.id || b.hash === record.id)
    if (book && !book.isCollection) {
      historyBooks.push({
        ...book,
        open_time: record.open_time
      })
    }
  })
  
  return historyBooks
})

// 记录打开详情
const recordDetailOpen = (book) => {
  const maxHistory = 100
  let detailOpenHist = JSON.parse(localStorage.getItem('detailOpenHistory') || '[]')
  
  // 移除已存在的记录
  detailOpenHist = detailOpenHist.filter(record => record.id !== book.id && record.id !== book.hash)
  
  // 添加新记录到开头
  detailOpenHist.unshift({
    id: book.id || book.hash,
    open_time: Math.floor(Date.now() / 1000)
  })
  
  // 保持最大数量限制
  if (detailOpenHist.length > maxHistory) {
    detailOpenHist = detailOpenHist.slice(0, maxHistory)
  }
  
  localStorage.setItem('detailOpenHistory', JSON.stringify(detailOpenHist))
  
  // 触发响应式更新
  detailHistoryUpdateTrigger.value++
}

defineExpose({
  showBookHistory,
  recordDetailOpen
})
</script>

<style lang="stylus">
.side-history-modal
  background-color: var(--el-mask-color-extra-light)

  .el-drawer__body
    padding-top: 0

.history-content
  height: calc(100vh - 120px)
  overflow-y: auto

.history-list
  display: flex
  flex-direction: column
  gap: 12px
  padding: 8px

.history-item
  display: flex
  align-items: center
  padding: 12px
  border: 1px solid var(--el-border-color)
  border-radius: 8px
  cursor: pointer
  transition: all 0.3s ease

  &:hover
    background-color: var(--el-fill-color-light)
    border-color: var(--el-color-primary)

.history-item-index
  width: 30px
  height: 30px
  display: flex
  align-items: center
  justify-content: center
  background-color: var(--el-color-primary)
  color: white
  border-radius: 50%
  font-size: 12px
  font-weight: bold
  margin-right: 12px

.history-item-cover
  width: 60px
  height: 85px
  object-fit: cover
  border-radius: 4px
  margin-right: 12px

.history-item-info
  flex: 1
  display: flex
  flex-direction: column
  gap: 4px

.history-item-title
  font-size: 14px
  font-weight: 500
  color: var(--el-text-color-primary)
  line-height: 1.4
  overflow: hidden
  text-overflow: ellipsis
  display: -webkit-box
  -webkit-line-clamp: 2
  -webkit-box-orient: vertical

.history-item-time
  font-size: 12px
  color: var(--el-text-color-secondary)

.history-item-meta
  font-size: 12px
  color: var(--el-text-color-regular)
</style>