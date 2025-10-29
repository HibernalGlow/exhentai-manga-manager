<template>
  <el-row class="pagination-bar">
    <el-pagination
      v-model:currentPage="localCurrentPage"
      v-model:page-size="localPageSize"
      :page-sizes="pageSizes"
      size="small"
      :layout="layout"
      :total="total"
      @size-change="onSizeChange"
      @current-change="onCurrentChange"
      background
    />
  </el-row>
  
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  currentPage: { type: Number, required: true },
  pageSize: { type: Number, default: 24 },
  total: { type: Number, required: true },
  pageSizes: { type: Array, default: () => [12, 24, 42, 72, 500, 5000, 1000000] },
  layout: { type: String, default: 'total, sizes, prev, pager, next, jumper' },
})

const emit = defineEmits(['update:currentPage', 'update:pageSize', 'size-change', 'current-change'])

const localCurrentPage = ref(props.currentPage)
const localPageSize = ref(props.pageSize)

watch(() => props.currentPage, (v) => { localCurrentPage.value = v })
watch(() => props.pageSize, (v) => { localPageSize.value = v })

function onSizeChange(size) {
  emit('update:pageSize', size)
  emit('size-change', size)
}

function onCurrentChange(page) {
  emit('update:currentPage', page)
  emit('current-change', page)
}
</script>


