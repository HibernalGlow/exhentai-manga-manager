<template>
  <el-drawer
    v-model="localVisible"
    direction="btt"
    size="calc(100vh - 60px)"
    destroy-on-close
    class="collection-drawer"
  >
    <template #header>
      <div>
        <span class="open-collection-title">{{ title }}</span>
        <el-button
          type="primary"
          :icon="Edit"
          plain
          link
          class="collection-edit-button"
          @click="$emit('edit-current-collection')"
        />
      </div>
    </template>

    <div class="collection-book-card-list">
      <div
        v-for="(book, index) in bookList"
        :key="book.id"
        class="book-card-frame"
      >
        <BookCard
          :book="book"
          :search-string="searchString"
          :tabindex="index + 1"
          @open-book-detail="(b) => $emit('open-book-detail', b)"
          @handle-click-cover="(b) => $emit('handle-click-cover', b)"
          @on-book-context-menu="(e, b) => $emit('on-book-context-menu', e, b)"
          @handle-search-string="(q) => $emit('handle-search-string', q)"
          @search-from-tag="(tag, cat) => $emit('search-from-tag', tag, cat)"
          @open-local-book="(b) => $emit('open-local-book', b)"
          @view-manga="(b) => $emit('view-manga', b)"
        />
      </div>
    </div>
  </el-drawer>
</template>

<script setup>
import { ref, watch } from 'vue'
import { Edit } from '@element-plus/icons-vue'
import BookCard from '../BookCard.vue'

const props = defineProps({
  modelValue: { type: Boolean, required: true },
  title: { type: String, default: '' },
  bookList: { type: Array, default: () => [] },
  searchString: { type: String, default: '' },
})

const emit = defineEmits([
  'update:modelValue',
  'edit-current-collection',
  'open-book-detail',
  'handle-click-cover',
  'on-book-context-menu',
  'handle-search-string',
  'search-from-tag',
  'open-local-book',
  'view-manga',
])

const localVisible = ref(props.modelValue)
watch(() => props.modelValue, (v) => { localVisible.value = v })
watch(localVisible, (v) => emit('update:modelValue', v))
</script>


