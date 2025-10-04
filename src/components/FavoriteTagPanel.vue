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
        <el-space wrap size="small">
          <el-tag
              v-for="tag in favoriteTags"
              :key="`${tag.cat}-${tag.tag}`"
              class="favorite-tag-chip"
              :style="{ '--tag-color': tag.color || '#409EFF' }"
              effect="plain"
              size="small"
              @click="appendTag(tag)"
              @contextmenu.prevent="appendTag(tag, '-')"
          >
            <span class="favorite-tag-chip-dot" :style="{ backgroundColor: tag.color || '#409EFF' }"></span>
            <span class="favorite-tag-chip-label">{{ tag.display }}</span>
            <span class="favorite-tag-chip-value">{{ tag.value }}</span>
          </el-tag>
        </el-space>
      </div>
      <div class="favorite-tag-hint">
        {{ $t('m.collectTagQuickPickHint') }}
      </div>
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
  max-height: 240px
  overflow-y: auto

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

.favorite-tag-chip-value
  font-size: 11px
  color: var(--el-text-color-secondary)

.favorite-tag-hint
  margin-top: 10px
  font-size: 12px
  color: var(--el-text-color-secondary)

.fade-in-enter-from,
.fade-in-leave-to
  opacity: 0
  transform: translateY(-4px)

.fade-in-enter-active,
.fade-in-leave-active
  transition: all .12s ease
</style>