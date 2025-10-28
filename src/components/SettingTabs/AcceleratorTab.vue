<template>
  <el-descriptions
      :column="2" size="small" style="margin-top: 16px;"
      v-for="group in acceleratorInfo" :key="group.group"
      :title="$t(`ac.${group.group}`)"
  >
    <el-descriptions-item v-for="(value, key) in group.accelerators" :key="value" width="22em">
      <template #label><span style="display: inline-block; min-width: 10em;">{{
          $t(`ac.${group.group}_${key}`)
        }}</span></template>
      <el-tag>{{value}}</el-tag>
    </el-descriptions-item>
  </el-descriptions>
</template>

<script setup>
const props = defineProps({
  acceleratorInfo: {
    type: Array,
    default: () => []
  }
})
</script>