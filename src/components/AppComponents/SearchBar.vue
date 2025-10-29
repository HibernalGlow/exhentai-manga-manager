<template>
  <div class="book-search-bar">
    <div class="search-bar-left">
      <el-button
        type="primary"
        :icon="TreeViewAlt"
        plain
        @click="$emit('open-folder-tree')"
        :title="$t('m.folderTree')"
        class="search-bar-button"
      />

      <slot name="left-extra" />
    </div>

    <div class="search-bar-center">
      <div class="search-input-wrapper" ref="searchInputWrapper">
        <el-autocomplete
          ref="searchAutocomplete"
          :model-value="searchString"
          :fetch-suggestions="querySearch"
          @focus="handleSearchFocus"
          @blur="handleSearchBlur"
          @click="handleSearchFocus"
          @keyup.enter="$emit('search-book')"
          @change="handleSearchStringChange"
          @input="handleInput"
          clearable
          :trigger-on-focus="false"
          class="search-input"
        >
          <template #default="{ item }">
            <span class="autocomplete-label">{{ item.label }}</span>
            <span class="autocomplete-value">{{ item.value }}</span>
          </template>
        </el-autocomplete>
        <SearchAgilePanel
          ref="searchAgilePanelRef"
          :favorite-tags="favoriteTagsForSearch"
          :visible="favoriteTagPanelVisible"
          :enable-mixed="enableMixedGenderSearch"
          :panel-height="favoriteTagPanelHeight"
          @append-tag="(tag, modifier, event) => appendCollectTag(tag, modifier, event)"
          @hide-panel="handlePanelHide"
          @show-panel="handlePanelShow"
          @update:enable-mixed="(v) => $emit('update:enableMixedGenderSearch', v)"
          @update:panel-height="(h) => updatePanelHeight(h)"
          @apply-search-history="applySearchHistory"
        />
      </div>
    </div>

    <div class="search-bar-right">
      <el-button type="primary" :icon="Search32Filled" plain @click="$emit('search-book')" :title="$t('m.search')" class="search-bar-button" />
      <el-button :icon="MdShuffle" plain @click="$emit('shuffle-book')" :title="$t('m.shuffle')" class="search-bar-button" />
      <el-button type="primary" :icon="MdRefresh" plain :title="$t('m.manualScan')" @click="$emit('load-book-list', true)" :loading="buttonLoadBookListLoading" class="search-bar-button" />
      <el-button type="primary" :icon="MdCodeDownload" plain :title="$t('m.batchGetMetadata')" @click="$emit('get-book-list-metadata')" :loading="buttonGetMetadatasLoading" class="search-bar-button" />
      <el-button :icon="ArrowTrendingLines20Filled" plain @click="$emit('open-tag-graph')" :title="$t('m.tagAnalysis')" class="search-bar-button" />
      <el-button :icon="SettingIcon" plain @click="$emit('open-setting')" :title="$t('m.setting')" class="search-bar-button" />
      <el-select :placeholder="$t('m.sort_filter')" @change="(v) => $emit('sort-change', v)" clearable v-model="localSortValue" class="sort-select">
        <el-option-group :label="$t('m.filter')">
          <el-option :label="$t('m.all')" value="" />
          <el-option :label="$t('m.bookmarkOnly')" value="mark" />
          <el-option :label="$t('m.collectionOnly')" value="collection" />
          <el-option :label="$t('m.hiddenOnly')" value="hidden" />
          <el-option :label="$t('m.recentReadOnly')" value="recentRead" />
          <el-option :label="$t('m.noTagOnly')" value="notag" />
          <el-option :label="$t('m.noCategoryOnly')" value="nocategory" />
          <el-option :label="$t('m.duplicateGalleryOnly')" value="duplicateGallery" />
        </el-option-group>
        <el-option-group :label="$t('m.sort')">
          <el-option :label="$t('m.shuffle')" value="shuffle" />
          <el-option :label="$t('m.urlGroupAscend')" value="urlGroupAscend" />
          <el-option :label="$t('m.urlGroupDescend')" value="urlGroupDescend" />
          <el-option :label="$t('m.collectTagCountAscend')" value="collectTagCountAscend" />
          <el-option :label="$t('m.collectTagCountDescend')" value="collectTagCountDescend" />
          <el-option :label="$t('m.duplicateCountAscend')" value="duplicateCountAscend" />
          <el-option :label="$t('m.duplicateCountDescend')" value="duplicateCountDescend" />
          <el-option :label="$t('m.addTimeAscend')" value="addAscend" />
          <el-option :label="$t('m.addTimeDescend')" value="addDescend" />
          <el-option :label="$t('m.mtimeAscend')" value="mtimeAscend" />
          <el-option :label="$t('m.mtimeDescend')" value="mtimeDescend" />
          <el-option :label="$t('m.postTimeAscend')" value="postAscend" />
          <el-option :label="$t('m.postTimeDescend')" value="postDescend" />
          <el-option :label="$t('m.ratingAscend')" value="scoreAscend" />
          <el-option :label="$t('m.ratingDescend')" value="scoreDescend" />
          <el-option :label="$t('m.readCountAscend')" value="readCountAscend" />
          <el-option :label="$t('m.readCountDescend')" value="readCountDescend" />
          <el-option :label="$t('m.artistAscend')" value="artistAscend" />
          <el-option :label="$t('m.artistDescend')" value="artistDescend" />
          <el-option :label="$t('m.titleAscend')" value="titleAscend" />
          <el-option :label="$t('m.titleDescend')" value="titleDescend" />
          <el-option :label="$t('m.pageAscend')" value="pageAscend" />
          <el-option :label="$t('m.pageDescend')" value="pageDescend" />
        </el-option-group>
      </el-select>
    </div>

    <div class="edit-buttons">
      <el-button v-if="!editTagView && !editCollectionView" plain @click="$emit('enter-edit-collection')" :icon="CicsSystemGroup" :title="$t('m.manageCollection')" />
      <el-button v-if="editCollectionView" type="primary" plain @click="$emit('add-collection')" :icon="Collections24Regular" :title="$t('m.addCollection')" />
      <el-button v-if="editCollectionView" type="primary" plain @click="$emit('edit-collection')" :icon="Edit" :title="$t('m.editCollection')" />
      <el-button v-if="editCollectionView" type="primary" plain @click="$emit('save-collection')" :icon="Save16Regular" :title="$t('m.save')" />
      <el-button v-if="editCollectionView" type="primary" plain @click="$emit('exit-collection')" :icon="MdExit" :title="$t('m.exit')" />
      <el-button v-if="!editTagView && !editCollectionView" plain @click="$emit('enter-edit-tag')" :icon="TagGroup" :title="$t('m.manageTag')" />
      <el-button v-if="editTagView" type="primary" plain @click="$emit('exit-edit-tag')" :icon="MdExit" :title="$t('m.exit')" />
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { Setting as SettingIcon, Edit } from '@element-plus/icons-vue'
import { ArrowTrendingLines20Filled, Collections24Regular, Search32Filled, Save16Regular } from '@vicons/fluent'
import { MdShuffle, MdRefresh, MdCodeDownload, MdExit } from '@vicons/ionicons4'
import { TreeViewAlt, CicsSystemGroup, TagGroup } from '@vicons/carbon'

import SearchAgilePanel from '../SearchAgilePanel.vue'

const props = defineProps({
  searchString: String,
  sortValue: [String, undefined],
  setting: { type: Object, required: true },
  favoriteTagsForSearch: { type: Array, default: () => [] },
  enableMixedGenderSearch: { type: Boolean, default: false },
  favoriteTagPanelVisible: { type: Boolean, default: false },
  favoriteTagPanelHeight: [String, Number],
  buttonLoadBookListLoading: { type: Boolean, default: false },
  buttonGetMetadatasLoading: { type: Boolean, default: false },
  editTagView: { type: Boolean, default: false },
  editCollectionView: { type: Boolean, default: false },

  // function props (delegate to parent logic)
  querySearch: { type: Function, required: true },
  handleSearchFocus: { type: Function, required: true },
  handleSearchBlur: { type: Function, required: true },
  handleSearchStringChange: { type: Function, required: true },
  handleInput: { type: Function, required: true },
  appendCollectTag: { type: Function, required: true },
  handlePanelHide: { type: Function, required: true },
  handlePanelShow: { type: Function, required: true },
  updatePanelHeight: { type: Function, required: true },
  applySearchHistory: { type: Function, required: true },
})

defineEmits([
  'open-folder-tree',
  'search-book',
  'shuffle-book',
  'load-book-list',
  'get-book-list-metadata',
  'open-tag-graph',
  'open-setting',
  'sort-change',
  'enter-edit-collection',
  'add-collection',
  'edit-collection',
  'save-collection',
  'exit-collection',
  'enter-edit-tag',
  'exit-edit-tag',
  'update:enableMixedGenderSearch',
])

const localSortValue = ref(props.sortValue)
watch(() => props.sortValue, (v) => { localSortValue.value = v })
const searchAgilePanelRef = ref(null)

defineExpose({
  addSearchHistory(query) {
    try {
      searchAgilePanelRef.value?.addSearchHistory?.(query)
    } catch {}
  }
})

</script>



