<template>
  <div>
    <div id="progressbar" :style="{ width: progress + '%' }"></div>
    <el-button class="fullscreen-button" circle :icon="FullScreen" size="large" @click="$emit('switch-fullscreen')"></el-button>
  </div>
</template>

<script setup>
import { FullScreen } from '@element-plus/icons-vue'

defineProps({
  progress: { type: Number, default: 0 },
})

defineEmits(['switch-fullscreen'])
</script>


