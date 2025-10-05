<template>
  <transition name="fade-in">
    <div
        v-if="visible"
        class="favorite-tag-panel"
        @mouseleave="scheduleHide"
    >
      <div class="favorite-tag-header">
        <span>{{ $t('m.collectTagQuickPick') }}</span>
        <div class="header-controls">
          <el-switch v-model="localEnableMixed" size="small" />
          <span class="mixed-label">{{ $t('m.enableMixedGenderSearch') }}</span>
          <el-button text size="small" @click="$emit('hide-panel')">{{ $t('m.close') }}</el-button>
        </div>
      </div>
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
      <div class="resize-handle" @mousedown="startResize"></div>
    </div>
  </transition>
</template>

<script>
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'FavoriteTagPanel',
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
    }
  },
  data() {
    return {
      isResizing: false,
      startY: 0,
      startHeight: 0
    }
  },
  methods: {
    appendTag(tag, modifier = '') {
      this.clearHideTimer()
      this.$emit('append-tag', tag, modifier)
    },
    scheduleHide() {
      this.clearHideTimer()
      this.hideTimer = setTimeout(() => {
        this.$emit('hide-panel')
        this.hideTimer = null
      }, 180)
    },
    clearHideTimer() {
      if (this.hideTimer) {
        clearTimeout(this.hideTimer)
        this.hideTimer = null
      }
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
    }
  },
  beforeUnmount() {
    this.clearHideTimer()
  }
})
</script>

<style lang="stylus" scoped>
.favorite-tag-panel
  position: absolute
  top: calc(100% + 6px)
  left: 0
  right: 0
  z-index: 1200
  background: var(--el-bg-color)
  border: 1px solid var(--el-border-color)
  border-radius: 8px
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.15)
  padding: 12px 14px 10px
  text-align: left
  height: v-bind('panelHeight + "px"')
  max-height: 600px
  min-height: 120px
  overflow-y: auto
  resize: none

.favorite-tag-header
  display: flex
  align-items: center
  justify-content: space-between
  gap: 8px
  margin-bottom: 6px
  font-weight: 600
  font-size: 13px

.header-controls
  display: flex
  align-items: center
  gap: 6px

.mixed-label
  font-size: 12px
  color: var(--el-text-color-secondary)

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

.resize-handle
  position: absolute
  bottom: 0
  left: 0
  right: 0
  height: 6px
  cursor: ns-resize
  background: linear-gradient(to bottom, transparent 0%, var(--el-border-color-light) 50%, transparent 100%)
  border-radius: 0 0 8px 8px

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