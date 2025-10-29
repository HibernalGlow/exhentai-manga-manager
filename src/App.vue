<template>
  <el-config-provider :locale="localeFile">
    <AppTopControls :progress="progress" @switch-fullscreen="switchFullscreen" />
    <SearchBar
      :search-string="searchString"
      :sort-value="sortValue"
      :setting="setting"
      :favorite-tags-for-search="favoriteTagsForSearch"
      :enable-mixed-gender-search="enableMixedGenderSearch"
      :favorite-tag-panel-visible="favoriteTagPanelVisible"
      :favorite-tag-panel-height="favoriteTagPanelHeight"
      :button-load-book-list-loading="buttonLoadBookListLoading"
      :button-get-metadatas-loading="buttonGetMetadatasLoading"
      :edit-tag-view="editTagView"
      :edit-collection-view="editCollectionView"
      :query-search="querySearch"
      :handle-search-focus="handleSearchFocus"
      :handle-search-blur="handleSearchBlur"
      :handle-search-string-change="handleSearchStringChange"
      :handle-input="handleInput"
      :append-collect-tag="appendCollectTag"
      :handle-panel-hide="handlePanelHide"
      :handle-panel-show="handlePanelShow"
      :update-panel-height="(h, ...rest) => updatePanelHeight(h, setting, () => $refs.SettingRef.saveSetting())"
      :apply-search-history="(q) => applySearchHistory(q)"
      :add-search-history="(q) => addSearchHistory(q)"
      @open-folder-tree="$refs.FolderTreeRef.openFolderTree()"
      @search-book="searchBook"
      @shuffle-book="shuffleBook"
      @load-book-list="(scan) => loadBookList(scan)"
      @get-book-list-metadata="getBookListMetadata"
      @open-tag-graph="$refs.TagGraphRef.displayTagGraph()"
      @open-setting="() => { $refs.SettingRef.dialogVisibleSetting = true }"
      @sort-change="(val) => handleSortChange(val)"
      @enter-edit-collection="$refs.EditViewRef.enterEditCollectionView()"
      @add-collection="$refs.EditViewRef.addCollection()"
      @edit-collection="$refs.EditViewRef.editCollection()"
      @save-collection="$refs.EditViewRef.saveCollection()"
      @exit-collection="$refs.EditViewRef.exitCollectionView()"
      @enter-edit-tag="$refs.EditViewRef.enterEditTagView()"
      @exit-edit-tag="$refs.EditViewRef.exitEditTagView()"
    >
      <template #left-extra>
        <BookHistoryButton :book-list="bookList" :setting="setting" @open-book-detail="openBookDetailFromHistory" ref="BookHistoryButtonRef" class="search-bar-button" />
            </template>
    </SearchBar>
    <RandomTags
        ref="randomTagsRef"
        v-if="!editTagView && !editCollectionView && !setting.disableRandomTag"
        @search="handleSearchString"
    />
    <template v-if="!editTagView && !editCollectionView">
      <BookListGrid
          :book-list="visibleChunkDisplayBookList"
          :visibility-map="visibilityMap"
                :search-string="searchString"
          :sort-value="sortValue"
          :disable-random-tag="setting.disableRandomTag"
          :on-lazy-load="loadBookCardContent"
          @open-book-detail="openBookDetailFromHistory"
          @handle-click-cover="handleClickCover"
                @on-book-context-menu="onBookContextMenu"
                @handle-search-string="handleSearchString"
                @search-from-tag="searchFromTag"
          @open-local-book="(book) => $refs.BookDetailDialogRef.openLocalBook(book)"
          @view-manga="(book) => $refs.InternalViewerRef.viewManga(book)"
          @open-collection="openCollection"
      />
    </template>
      <EditView
          ref="EditViewRef"
          @preview-manga="previewManga"
          @search-from-tag="searchFromTag"
          @load-book-list="loadBookList"
          @get-books-metadata="(bookList, gap, callback) => $refs.SearchDialogRef.getBooksMetadata(bookList, gap, callback)"
          @handle-remove-book-display="handleRemoveBookDisplay"
      />
    <PaginationBar
        v-model:currentPage="currentPage"
        v-model:pageSize="setting.pageSize"
          :total="displayBookCount"
          @size-change="handleSizeChange"
          @current-change="handleCurrentPageChange"
    />
    <CollectionDrawer
        v-model="drawerVisibleCollection"
        :title="openCollectionTitle"
        :book-list="openCollectionBookList"
              :search-string="searchString"
        @edit-current-collection="editCurrentCollection"
        @open-book-detail="openBookDetailFromHistory"
        @handle-click-cover="handleClickCover"
              @on-book-context-menu="onBookContextMenu"
              @handle-search-string="handleSearchString"
              @search-from-tag="searchFromTag"
        @open-local-book="(book) => $refs.BookDetailDialogRef.openLocalBook(book)"
        @view-manga="(book) => $refs.InternalViewerRef.viewManga(book)"
          />
    <MoveFileDialog ref="moveDlgRef" :save-book-fn="saveBook"/>
    <BookDetailDialog
        ref="BookDetailDialogRef"
        :search-string="searchString"
        @open-content-view="openContentView"
        @open-thumbnail-view="openThumbnailView"
        @save-collection="$refs.EditViewRef.saveCollection()"
        @handle-remove-book-display="handleRemoveBookDisplay"
        @open-search-dialog="$refs.SearchDialogRef.openSearchDialog(bookDetail)"
        @get-book-info="$refs.SearchDialogRef.getBookInfo(bookDetail)"
        @search-from-tag="searchFromTag"
        @jump-mange-detail="jumpMangeDetail"
        @detail-opened="recordDetailOpen"
    />
    <InternalViewer
        ref="InternalViewerRef"
        @to-next-manga="toNextManga"
        @to-next-manga-random="toNextMangaRandom"
        @update-window-title="updateWindowTitle"
        @rescan-book="(book) => $refs.BookDetailDialogRef.rescanBook(book)"
    />
    <FolderTree ref="FolderTreeRef" @chunk-list="chunkList" @search="handleSearchString"/>
    <TagGraph ref="TagGraphRef" @search="handleSearchString"/>
    <SearchDialog ref="SearchDialogRef"/>
    <Setting ref="SettingRef" @load-book-list="loadBookList" @load-collection-list="loadCollectionList"/>
  </el-config-provider>
</template>

<script src="./App.options.js"></script>
