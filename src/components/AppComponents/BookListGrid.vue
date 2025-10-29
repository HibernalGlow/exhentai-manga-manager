<template>
  <el-row :gutter="20" class="book-card-area">
    <el-col :span="24" class="book-card-list" :style="{height: disableRandomTag ? 'calc(100vh - 96px)' : 'calc(100vh - 134px)'}">
      <div
        v-for="(book, index) in bookList"
        :key="book.id"
        class="book-card-frame"
        v-lazy:[book.id]="onLazyLoad"
        :tabindex="index + 1"
      >
        <transition name="pop">
          <BookCard
            v-if="!book.isCollection && !book.collectionHide && (sortValue === 'hidden' || !book.hiddenBook) && !book.folderHide && visibilityMap[book.id]"
            :book="book"
            :search-string="searchString"
            @open-book-detail="(b) => $emit('open-book-detail', b)"
            @handle-click-cover="(b) => $emit('handle-click-cover', b)"
            @on-book-context-menu="(e, b) => $emit('on-book-context-menu', e, b)"
            @handle-search-string="(q) => $emit('handle-search-string', q)"
            @search-from-tag="(tag, cat) => $emit('search-from-tag', tag, cat)"
            @open-local-book="(b) => $emit('open-local-book', b)"
            @view-manga="(b) => $emit('view-manga', b)"
          />
          <BookCardCollection
            v-else-if="book.isCollection && !book.folderHide && visibilityMap[book.id]"
            :book="book"
            @open-collection="(c) => $emit('open-collection', c)"
          />
        </transition>
      </div>
    </el-col>
  </el-row>
</template>

<script setup>
import BookCard from '../BookCard.vue'
import BookCardCollection from '../BookCardCollection.vue'

const props = defineProps({
  bookList: { type: Array, required: true },
  visibilityMap: { type: Object, required: true },
  searchString: { type: String, default: '' },
  sortValue: { type: String, default: '' },
  disableRandomTag: { type: Boolean, default: false },
  onLazyLoad: { type: Function, required: true },
})

defineEmits([
  'open-book-detail',
  'handle-click-cover',
  'on-book-context-menu',
  'handle-search-string',
  'search-from-tag',
  'open-local-book',
  'view-manga',
  'open-collection',
])
</script>


