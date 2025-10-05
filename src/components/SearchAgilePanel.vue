<template>
  <transition name="fade-in">
    <div
        v-if="visible"
        ref="panelRef"
        class="search-agile-panel"
    >
      <div class="search-agile-header">
        <div class="tab-buttons">
          <button
              v-for="tab in tabsComputed"
              :key="tab.key"
              :class="['tab-button', { active: activeTab === tab.key }]"
              @click.stop.prevent="switchTab(tab.key, $event)"
          >
            {{ tab.label }}
          </button>
        </div>
        <div class="header-controls">
          <el-switch v-if="activeTab === 'favorite'" v-model="localEnableMixed" size="small" />
          <span v-if="activeTab === 'favorite'" class="mixed-label">{{ $t('m.enableMixedGenderSearch') }}</span>
          <el-button text size="small" @click.stop="togglePin" :title="isPinned ? '取消固定' : '固定面板'">
            <el-icon><component :is="isPinned ? 'Lock' : 'Unlock'" /></el-icon>
          </el-button>
          <el-button text size="small" @click.stop="$emit('hide-panel')">{{ $t('m.close') }}</el-button>
        </div>
      </div>
      <div class="search-agile-content">
        <!-- 收藏标签Tab -->
        <div v-if="activeTab === 'favorite'" class="tab-content">
          <div class="favorite-tag-chips">
            <template v-for="(category, categoryIndex) in groupedTags" :key="category.name">
              <div class="category-group" v-if="category.tags.length > 0">
                <div class="category-header">
                  <span class="category-name">{{ category.name }}</span>
                  <span class="category-count">{{ category.tags.length }}</span>
                </div>
                <div class="category-tags">
                  <el-space wrap size="small">
                    <el-tag
                        v-for="tag in category.tags"
                        :key="`${tag.cat}-${tag.tag}`"
                        class="favorite-tag-chip"
                        :style="{ '--tag-color': tag.color || '#409EFF' }"
                        effect="plain"
                        size="small"
                        @click="appendTag(tag)"
                        @contextmenu.prevent="appendTag(tag, '-')"
                    >
                      <span class="favorite-tag-chip-dot" :style="{ backgroundColor: tag.color || '#409EFF' }"></span>
                      <span class="favorite-tag-chip-label">{{ tag.display.split(':')[1] }}</span>
                      <span class="favorite-tag-chip-value">{{ tag.value }}</span>
                    </el-tag>
                  </el-space>
                </div>
              </div>
            </template>
          </div>
          <div class="favorite-tag-hint">
            {{ $t('m.collectTagQuickPickHint') }}
          </div>
        </div>

        <!-- 搜索历史Tab -->
        <div v-if="activeTab === 'history'" class="tab-content">
          <div class="search-history-list">
            <div v-if="searchHistory.length === 0" class="empty-history">
              <span>{{ $t('m.noSearchHistory') }}</span>
            </div>
            <div v-else class="history-items">
              <div
                  v-for="(item, index) in searchHistory"
                  :key="index"
                  class="history-item"
              >
                <div class="history-content">
                  <div class="history-tags">
                    <el-space wrap size="small">
                      <el-tag
                          v-for="(tag, tagIndex) in parseSearchQuery(item.query)"
                          :key="tagIndex"
                          class="history-tag-chip"
                          :style="{ '--tag-color': tag.color || '#909399' }"
                          effect="plain"
                          size="small"
                          @click="applySearchHistory(item)"
                      >
                        <span v-if="tag.prefix" class="tag-prefix">{{ tag.prefix }}</span>
                        <span v-if="tag.translatedCat" class="tag-category">{{ tag.translatedCat }}:</span>
                        <span class="tag-name">{{ tag.translatedTag || tag.original }}</span>
                        <span v-if="tag.original !== tag.translatedTag" class="tag-original">{{ tag.original }}</span>
                      </el-tag>
                    </el-space>
                  </div>
                  <span class="history-time">{{ formatTime(item.timestamp) }}</span>
                </div>
                <div class="history-actions">
                  <el-button
                      text
                      size="small"
                      @click.stop="applySearchHistory(item)"
                      :title="$t('m.applySearch')"
                  >
                    <el-icon><Search /></el-icon>
                  </el-button>
                  <el-button
                      text
                      size="small"
                      @click.stop="removeSearchHistory(index)"
                      :title="$t('m.delete')"
                  >
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </div>
              </div>
            </div>
          </div>
          <div class="history-actions-bar">
            <el-button
                v-if="searchHistory.length > 0"
                text
                size="small"
                @click="clearAllHistory"
                :title="$t('m.clearAllHistory')"
            >
              <el-icon><Delete /></el-icon>
              {{ $t('m.clearAll') }}
            </el-button>
          </div>
        </div>
      </div>
      <div class="resize-handle" @mousedown="startResize"></div>
    </div>
  </transition>
</template>

<script>
import { defineComponent } from 'vue'
import { Search, Delete, Lock, Unlock } from '@element-plus/icons-vue'
import searchHistoryManager from '../utils/searchHistoryManager.js'

export default defineComponent({
  name: 'SearchAgilePanel',
  components: {
    Search,
    Delete,
    Lock,
    Unlock
  },
  props: {
    favoriteTags: {
      type: Array,
      default: () => []
    },
    visible: {
      type: Boolean,
      default: false
    },
    enableMixed: {
      type: Boolean,
      default: false
    },
    panelHeight: {
      type: Number,
      default: 240
    }
  },
  emits: ['hide-panel', 'append-tag', 'update:enableMixed', 'update:panelHeight', 'apply-search-history'],
  computed: {
    localEnableMixed: {
      get() {
        return this.enableMixed
      },
      set(val) {
        this.$emit('update:enableMixed', val)
      }
    },
    groupedTags() {
      const groups = {}
      this.favoriteTags.forEach(tag => {
        const category = tag.display.split(':')[0] // 获取类别部分
        if (!groups[category]) {
          groups[category] = {
            name: category,
            tags: []
          }
        }
        groups[category].tags.push(tag)
      })

      // 按照类别名称排序
      return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name))
    },
    tabsComputed() {
      // 确保翻译函数可用，否则返回默认值
      const t = this.$t || (() => '')
      return [
        { key: 'favorite', label: t('m.favoriteTags') || '收藏标签' },
        { key: 'history', label: t('m.searchHistory') || '搜索历史' }
      ]
    }
  },
  data() {
    return {
      activeTab: 'favorite', // 当前激活的tab
      isResizing: false,
      startY: 0,
      startHeight: 0,
      searchHistory: [], // 搜索历史
      isPinned: false // 是否固定面板
    }
  },
  mounted() {
    this.loadSearchHistory()
    // 延迟添加点击外部监听器，避免影响面板打开时的点击事件
    this.$nextTick(() => {
      setTimeout(() => {
        this.addClickOutsideListener()
      }, 300)
    })
  },
  watch: {
    visible(newVal) {
      if (newVal) {
        // 面板显示时，延迟添加点击外部监听器
        this.removeClickOutsideListener()
        this.$nextTick(() => {
          setTimeout(() => {
            this.addClickOutsideListener()
          }, 300)
        })
      } else {
        // 面板隐藏时，移除监听器
        this.removeClickOutsideListener()
      }
    }
  },
  beforeUnmount() {
    this.removeClickOutsideListener()
  },
  methods: {
    appendTag(tag, modifier = '') {
      this.$emit('append-tag', tag, modifier)
    },
    switchTab(tabKey, event) {
      if (event) {
        event.stopPropagation()
        event.preventDefault()
      }
      this.activeTab = tabKey
    },
    addClickOutsideListener() {
      // 先移除旧的监听器，避免重复添加
      this.removeClickOutsideListener()
      // 使用冒泡阶段监听，这样@click.stop可以正常工作
      document.addEventListener('click', this.handleClickOutside, false)
    },
    removeClickOutsideListener() {
      document.removeEventListener('click', this.handleClickOutside, false)
    },
    handleClickOutside(event) {
      // 如果面板被固定，不自动隐藏
      if (this.isPinned) return
      
      if (!this.visible || !this.$refs.panelRef) return
      
      // 检查点击的目标元素
      const target = event.target
      
      // 检查点击是否在面板内部
      if (this.$refs.panelRef.contains(target)) return
      
      // 检查点击是否在搜索输入框或其父容器内
      const searchInputWrapper = document.querySelector('.search-input-wrapper')
      if (searchInputWrapper && searchInputWrapper.contains(target)) return
      
      // 检查是否点击了tab按钮
      if (target.closest('.tab-button')) return
      
      // 点击在外部，隐藏面板
      this.$emit('hide-panel')
    },
    togglePin() {
      this.isPinned = !this.isPinned
    },
    parseSearchQuery(query) {
      // 解析搜索查询，提取标签并添加翻译
      const tags = []
      if (!query) return tags

      // 匹配标签格式: letter:"tag"$ 或 ~letter:"tag"$ 或 -letter:"tag"$
      const tagPattern = /(~|-)?(\w+):"([^"]+)"\$/g
      let match

      while ((match = tagPattern.exec(query)) !== null) {
        const prefix = match[1] || '' // ~ 或 - 前缀
        const letter = match[2]
        const tagName = match[3]
        const original = `${letter}:"${tagName}"$`

        // 查找收藏标签中的匹配项以获取翻译和颜色
        const favoriteTag = this.favoriteTags.find(t => 
          t.letter === letter && t.tag === tagName
        )

        if (favoriteTag) {
          const [translatedCat, translatedTag] = favoriteTag.display.split(':')
          tags.push({
            prefix,
            original: tagName,
            translatedCat,
            translatedTag,
            color: favoriteTag.color,
            letter
          })
        } else {
          // 如果没有在收藏标签中找到，显示原始标签
          tags.push({
            prefix,
            original: tagName,
            translatedCat: letter,
            translatedTag: tagName,
            color: '#909399',
            letter
          })
        }
      }

      // 如果没有匹配到标签格式，把整个查询作为普通文本
      if (tags.length === 0) {
        tags.push({
          prefix: '',
          original: query,
          translatedCat: '',
          translatedTag: query,
          color: '#909399',
          letter: ''
        })
      }

      return tags
    },
    startResize(event) {
      this.isResizing = true
      this.startY = event.clientY
      this.startHeight = this.panelHeight

      document.addEventListener('mousemove', this.handleResize)
      document.addEventListener('mouseup', this.stopResize)

      event.preventDefault()
    },
    handleResize(event) {
      if (!this.isResizing) return

      const deltaY = event.clientY - this.startY
      const newHeight = Math.max(120, Math.min(600, this.startHeight + deltaY))

      this.$emit('update:panelHeight', newHeight)
    },
    stopResize() {
      this.isResizing = false
      document.removeEventListener('mousemove', this.handleResize)
      document.removeEventListener('mouseup', this.stopResize)
    },

    // 搜索历史相关方法
    loadSearchHistory() {
      this.searchHistory = searchHistoryManager.loadHistory()
    },
    addSearchHistory(query) {
      this.searchHistory = searchHistoryManager.addSearch(query, this.searchHistory)
    },
    applySearchHistory(item) {
      this.$emit('apply-search-history', item.query)
    },
    removeSearchHistory(index) {
      this.searchHistory = searchHistoryManager.removeSearch(index, this.searchHistory)
    },
    clearAllHistory() {
      this.searchHistory = searchHistoryManager.clearAllHistory()
    },
    formatTime(timestamp) {
      return searchHistoryManager.formatTime(timestamp)
    }
  },
  beforeUnmount() {
    this.clearHideTimer()
  }
})
</script>

<style lang="stylus" scoped>
.search-agile-panel
  position: absolute
  top: calc(100% + 6px)
  left: 0
  right: 0
  z-index: 1200
  background: var(--el-bg-color)
  border: 1px solid var(--el-border-color)
  border-radius: 8px
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.15)
  padding: 12px 14px 16px
  text-align: left
  height: v-bind('panelHeight + "px"')
  max-height: 600px
  min-height: 120px
  overflow-y: auto
  resize: none
  display: flex
  flex-direction: column

.search-agile-header
  display: flex
  align-items: center
  justify-content: space-between
  gap: 8px
  margin-bottom: 6px

.tab-buttons
  display: flex
  gap: 4px

.tab-button
  padding: 4px 12px
  border: none
  background: transparent
  color: var(--el-text-color-secondary)
  font-size: 13px
  font-weight: 500
  cursor: pointer
  border-radius: 4px
  transition: all 0.2s ease

.tab-button:hover
  background: var(--el-fill-color-light)
  color: var(--el-text-color-primary)

.tab-button.active
  background: var(--el-color-primary-light-9)
  color: var(--el-color-primary)

.header-controls
  display: flex
  align-items: center
  gap: 6px

.mixed-label
  font-size: 12px
  color: var(--el-text-color-secondary)

.search-agile-content
  flex: 1
  min-height: 0
  overflow-y: auto
  padding-bottom: 6px

.tab-content
  width: 100%
  height: 100%

.favorite-tag-chips
  width: 100%

.favorite-tag-chip
  display: inline-flex
  align-items: center
  gap: 6px
  cursor: pointer
  padding: 4px 8px 4px 6px
  border: 1px solid var(--tag-color)
  background: unquote('color-mix(in srgb, var(--tag-color) 16%, transparent)')
  transition: transform .12s ease, border-color .12s ease

.favorite-tag-chip:hover
  transform: translateY(-1px)
  border-color: unquote('color-mix(in srgb, var(--tag-color) 60%, var(--el-border-color))')

.favorite-tag-chip-dot
  width: 8px
  height: 8px
  border-radius: 50%

.favorite-tag-chip-label
  font-weight: 600
  max-width: 140px
  overflow: hidden
  white-space: nowrap
  text-overflow: ellipsis

.category-group
  margin-bottom: 12px

.category-group:last-child
  margin-bottom: 0

.category-header
  display: flex
  align-items: center
  justify-content: space-between
  margin-bottom: 6px
  padding: 4px 8px
  background: var(--el-fill-color-light)
  border-radius: 4px

.category-name
  font-weight: 600
  font-size: 12px
  color: var(--el-text-color-primary)

.category-count
  font-size: 11px
  color: var(--el-text-color-secondary)
  background: var(--el-border-color-light)
  padding: 2px 6px
  border-radius: 10px

.category-tags
  padding-left: 4px

.favorite-tag-hint
  margin-top: 10px
  font-size: 12px
  color: var(--el-text-color-secondary)

// 搜索历史样式
.search-history-list
  width: 100%

.empty-history
  display: flex
  justify-content: center
  align-items: center
  padding: 40px 20px
  color: var(--el-text-color-secondary)
  font-size: 14px

.history-items
  width: 100%

.history-item
  display: flex
  align-items: center
  justify-content: space-between
  padding: 8px 12px
  margin-bottom: 4px
  border-radius: 6px
  cursor: pointer
  transition: background-color 0.2s ease
  border: 1px solid transparent

.history-item:hover
  background: var(--el-fill-color-light)
  border-color: var(--el-border-color-light)

.history-content
  flex: 1
  min-width: 0

.history-text
  display: flex
  flex-wrap: wrap
  gap: 6px
  align-items: center
  margin-bottom: 2px
  line-height: 1.4

.history-tag-chip
  display: inline-flex
  align-items: center
  gap: 4px
  padding: 2px 8px
  border-radius: 4px
  font-size: 12px
  line-height: 1.4
  border: 1px solid
  background: var(--tag-bg-color, var(--el-fill-color-light))
  border-color: var(--tag-border-color, var(--el-border-color))
  color: var(--el-text-color-primary)
  transition: all 0.12s ease

.history-tag-chip:hover
  transform: translateY(-1px)
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1)

.tag-prefix
  font-weight: bold
  font-size: 13px
  opacity: 0.8

.tag-category
  font-weight: 600
  color: var(--tag-color, var(--el-color-primary))

.tag-translation
  font-weight: 600

.tag-original
  font-size: 11px
  opacity: 0.7
  font-style: italic

.history-time
  display: block
  font-size: 11px
  color: var(--el-text-color-secondary)

.history-actions
  display: flex
  gap: 4px
  margin-left: 8px

.history-actions-bar
  margin-top: 12px
  padding-top: 8px
  border-top: 1px solid var(--el-border-color-light)
  display: flex
  justify-content: flex-end

.resize-handle
  position: absolute
  bottom: 0
  left: 0
  right: 0
  height: 6px
  cursor: ns-resize
  background: linear-gradient(to bottom, transparent 0%, var(--el-border-color-light) 50%, transparent 100%)
  border-radius: 0 0 8px 8px
  flex-shrink: 0

.resize-handle:hover
  background: linear-gradient(to bottom, transparent 0%, var(--el-color-primary-light-5) 50%, transparent 100%)

.fade-in-enter-from,
.fade-in-leave-to
  opacity: 0
  transform: translateY(-4px)

.fade-in-enter-active,
.fade-in-leave-active
  transition: all .12s ease
</style>