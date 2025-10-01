<template>
  <!-- 最小化状态：小图标 -->
  <Transition name="fade">
    <div v-if="visible && minimized" class="log-mini-icon" @click="toggleMinimize">
      <el-badge :value="logs.length" :max="99" :hidden="logs.length === 0">
        <el-icon :size="24">
          <Document />
        </el-icon>
      </el-badge>
    </div>
  </Transition>

  <!-- 完整窗口 -->
  <Transition name="slide-fade">
    <div 
      v-if="visible && !minimized" 
      class="log-floating-window" 
      :style="windowStyle"
      ref="windowRef"
    >
      <div 
        class="log-header" 
        @mousedown="startDrag"
        @dblclick="toggleMinimize"
      >
        <span class="log-title">{{ title }}</span>
        <div class="log-controls">
          <el-tooltip content="最小化" placement="top">
            <el-button 
              size="small" 
              text 
              @click="toggleMinimize"
              icon="Minus"
            />
          </el-tooltip>
          <el-tooltip :content="collapsed ? '展开' : '折叠'" placement="top">
            <el-button 
              size="small" 
              text 
              @click="toggleCollapse"
              :icon="collapsed ? 'ArrowDown' : 'ArrowUp'"
            />
          </el-tooltip>
          <el-tooltip content="清空日志" placement="top">
            <el-button 
              size="small" 
              text 
              @click="clearLogs"
              icon="Delete"
            />
          </el-tooltip>
          <el-tooltip content="关闭" placement="top">
            <el-button 
              size="small" 
              text 
              @click="closeWindow"
              icon="Close"
            />
          </el-tooltip>
        </div>
      </div>
      <div v-show="!collapsed" class="log-content" ref="logContentRef">
        <div 
          v-for="(log, index) in logs" 
          :key="index" 
          :class="['log-item', `log-${log.type}`]"
        >
          <span class="log-time">{{ log.time }}</span>
          <span class="log-message">{{ log.message }}</span>
        </div>
        <div v-if="logs.length === 0" class="log-empty">
          {{ t('c.noLogs') }}
        </div>
      </div>
      <div v-show="!collapsed" class="log-footer">
        <span class="log-stats">
          {{ t('c.totalLogs') }}: {{ logs.length }} | 
          {{ t('c.success') }}: {{ successCount }} | 
          {{ t('c.failed') }}: {{ failedCount }}
        </span>
      </div>
      <!-- 调整大小手柄 -->
      <div class="resize-handle" @mousedown="startResize"></div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Document } from '@element-plus/icons-vue'

const { t } = useI18n()

interface LogItem {
  time: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
}

const props = defineProps({
  title: {
    type: String,
    default: '元数据获取日志'
  },
  maxLogs: {
    type: Number,
    default: 500
  }
})

const visible = ref(false)
const collapsed = ref(false)
const minimized = ref(false)
const logs = ref<LogItem[]>([])
const logContentRef = ref<HTMLElement | null>(null)
const windowRef = ref<HTMLElement | null>(null)

// 窗口位置和大小
const position = ref({ x: 20, y: 20 })
const size = ref({ width: 500, height: 400 })

// 拖动相关
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })

// 调整大小相关
const isResizing = ref(false)
const resizeStart = ref({ x: 0, y: 0, width: 0, height: 0 })

const successCount = computed(() => logs.value.filter(log => log.type === 'success').length)
const failedCount = computed(() => logs.value.filter(log => log.type === 'error').length)

const windowStyle = computed(() => ({
  right: `${position.value.x}px`,
  bottom: `${position.value.y}px`,
  width: `${size.value.width}px`,
  height: collapsed.value ? '40px' : `${size.value.height}px`,
  maxHeight: collapsed.value ? '40px' : 'calc(100vh - 100px)'
}))

// 添加日志
const addLog = (message: string, type: LogItem['type'] = 'info') => {
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  logs.value.push({ time, message, type })
  
  // 限制日志数量
  if (logs.value.length > props.maxLogs) {
    logs.value.shift()
  }
  
  // 自动滚动到底部
  nextTick(() => {
    if (logContentRef.value) {
      logContentRef.value.scrollTop = logContentRef.value.scrollHeight
    }
  })
}

// 清空日志
const clearLogs = () => {
  logs.value = []
}

// 显示窗口
const show = () => {
  visible.value = true
  minimized.value = false
}

// 隐藏窗口
const hide = () => {
  visible.value = false
}

// 关闭窗口
const closeWindow = () => {
  visible.value = false
}

// 切换折叠状态
const toggleCollapse = () => {
  collapsed.value = !collapsed.value
}

// 切换最小化状态
const toggleMinimize = () => {
  minimized.value = !minimized.value
}

// 开始拖动
const startDrag = (e: MouseEvent) => {
  if ((e.target as HTMLElement).closest('.log-controls')) {
    return // 如果点击的是控制按钮，不拖动
  }
  
  isDragging.value = true
  dragStart.value = {
    x: e.clientX + position.value.x,
    y: e.clientY + position.value.y
  }
  
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
  e.preventDefault()
}

const onDrag = (e: MouseEvent) => {
  if (!isDragging.value) return
  
  const newX = dragStart.value.x - e.clientX
  const newY = dragStart.value.y - e.clientY
  
  // 限制在视口内
  position.value = {
    x: Math.max(0, Math.min(window.innerWidth - 100, newX)),
    y: Math.max(0, Math.min(window.innerHeight - 100, newY))
  }
}

const stopDrag = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

// 开始调整大小
const startResize = (e: MouseEvent) => {
  isResizing.value = true
  resizeStart.value = {
    x: e.clientX,
    y: e.clientY,
    width: size.value.width,
    height: size.value.height
  }
  
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
  e.preventDefault()
  e.stopPropagation()
}

const onResize = (e: MouseEvent) => {
  if (!isResizing.value) return
  
  const deltaX = resizeStart.value.x - e.clientX
  const deltaY = resizeStart.value.y - e.clientY
  
  size.value = {
    width: Math.max(300, Math.min(800, resizeStart.value.width + deltaX)),
    height: Math.max(200, Math.min(600, resizeStart.value.height + deltaY))
  }
}

const stopResize = () => {
  isResizing.value = false
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
}

// 清理事件监听
onUnmounted(() => {
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
})

// 暴露方法给父组件
defineExpose({
  addLog,
  clearLogs,
  show,
  hide,
  visible
})
</script>

<style scoped>
/* 最小化图标 */
.log-mini-icon {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 50px;
  height: 50px;
  background: var(--el-color-primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 9999;
  transition: all 0.3s ease;
  color: white;
}

.log-mini-icon:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
}

/* 浮动窗口 */
.log-floating-window {
  position: fixed;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 9998;
  overflow: hidden;
  transition: height 0.3s ease;
  display: flex;
  flex-direction: column;
  min-width: 300px;
  min-height: 200px;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--el-fill-color-light);
  border-bottom: 1px solid var(--el-border-color);
  cursor: move;
  user-select: none;
  flex-shrink: 0;
}

.log-header:active {
  cursor: grabbing;
}

.log-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--el-text-color-primary);
  pointer-events: none;
}

.log-controls {
  display: flex;
  gap: 4px;
}

.log-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  font-size: 12px;
  font-family: 'Consolas', 'Monaco', monospace;
}

.log-item {
  padding: 4px 8px;
  margin-bottom: 4px;
  border-radius: 4px;
  display: flex;
  gap: 8px;
  line-height: 1.5;
}

.log-time {
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}

.log-message {
  color: var(--el-text-color-primary);
  word-break: break-all;
}

.log-info {
  background: var(--el-fill-color-lighter);
}

.log-success {
  background: rgba(103, 194, 58, 0.1);
  border-left: 3px solid var(--el-color-success);
}

.log-warning {
  background: rgba(230, 162, 60, 0.1);
  border-left: 3px solid var(--el-color-warning);
}

.log-error {
  background: rgba(245, 108, 108, 0.1);
  border-left: 3px solid var(--el-color-danger);
}

.log-empty {
  text-align: center;
  padding: 20px;
  color: var(--el-text-color-secondary);
}

.log-footer {
  padding: 6px 12px;
  background: var(--el-fill-color-lighter);
  border-top: 1px solid var(--el-border-color);
  font-size: 12px;
  flex-shrink: 0;
}

.log-stats {
  color: var(--el-text-color-secondary);
}

/* 调整大小手柄 */
.resize-handle {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 15px;
  height: 15px;
  cursor: nwse-resize;
  background: linear-gradient(135deg, transparent 50%, var(--el-border-color-darker) 50%);
}

.resize-handle:hover {
  background: linear-gradient(135deg, transparent 50%, var(--el-color-primary) 50%);
}

/* 滚动条样式 */
.log-content::-webkit-scrollbar {
  width: 6px;
}

.log-content::-webkit-scrollbar-track {
  background: var(--el-fill-color-lighter);
  border-radius: 3px;
}

.log-content::-webkit-scrollbar-thumb {
  background: var(--el-border-color-darker);
  border-radius: 3px;
}

.log-content::-webkit-scrollbar-thumb:hover {
  background: var(--el-text-color-secondary);
}

/* 过渡动画 */
.slide-fade-enter-active {
  transition: all 0.3s ease-out;
}

.slide-fade-leave-active {
  transition: all 0.2s cubic-bezier(1, 0.5, 0.8, 1);
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateY(20px);
  opacity: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: scale(0.8);
}
</style>
