<template>
  <el-dialog v-model="dialogVisibleSetting"
             width="54em"
             :modal="false"
             append-to-body
             top="60px"
             class="setting-dialog"
             @open='onSettingOpen'
  >
    <template #header><p class="setting-title">{{$t('m.setting')}}</p></template>
    <el-tabs v-model="activeSettingPanel" class="setting-tabs">
      <el-tab-pane :label="$t('m.general')" name="general">
        <el-row :gutter="8">
          <!--   display library & add/remove buttons jump to the library tab       -->
          <el-col :span="24">
            <div class="setting-line">
              <el-input class="lib-input" readonly :input-style="{ width: '0', padding: 0, border: 'none' }">
                <!-- left label -->
                <template #prepend>
                  <span class="setting-label">{{$t('m.library')}}</span>
                </template>

                <!-- inline preview of first 1-2 folders + "+N more" -->
                <template #suffix>
                  <div class="lib-preview">
                    <el-space wrap>
                      <el-tag v-for="p in libHead" :key="p" type="info">
                        <el-tooltip :content="p" placement="left-start">
                          <span class="chunk-path"> {{p}} </span></el-tooltip>
                      </el-tag>

                      <!-- +N more popover -->
                      <el-popover
                          v-if="libMoreCount > 0"
                          placement="bottom"
                          trigger="click"
                          width="520"
                      >
                        <template #reference>
                          <el-tag type="success" size="small">+{{libMoreCount}} {{$t('m.more') || 'more'}}</el-tag>
                        </template>

                        <!-- full list inside popover -->
                        <div class="lib-popover">
                          <el-scrollbar max-height="200" wrap-style="padding-bottom:10px">
                            <div class="lib-list">
                              <el-tag v-for="p in libs" :key="p" size="small" type="info" effect="plain">
                                <el-tooltip :content="p" placement="top">
                                  <span class="truncate">{{p}}</span>
                                </el-tooltip>
                              </el-tag>
                            </div>
                          </el-scrollbar>
                          <div class="lib-popover-actions">
                            <el-button size="small" @click="openLibrariesTab">{{
                                $t('m.manage') || 'Manage'
                              }}
                            </el-button>
                          </div>
                        </div>
                      </el-popover>

                      <!-- empty state -->
                      <span v-if="libs.length === 0" class="dim">{{
                          $t('m.noLibraryFolders') || 'No library folders added yet'
                        }}</span>
                    </el-space>
                  </div>
                </template>

                <!-- right button -->
                <template #append>
                  <el-button size="small" @click="openLibrariesTab">{{$t('m.manage') || 'Manage'}}</el-button>
                </template>
              </el-input>
            </div>
          </el-col>
          <el-col :span="24">
            <div class="setting-line">
              <el-input v-model="setting.metadataPath" :placeholder="$t('m.metadataPathDefault')">
                <template #prepend><span class="setting-label">{{$t('m.metadataPath')}}</span></template>
                <template #append>
                  <el-button @click="selectMetadataPath">{{$t('m.select')}}</el-button>
                </template>
              </el-input>
            </div>
          </el-col>
          <el-col :span="24">
            <div class="setting-line">
              <el-input v-model="setting.defaultSqlPath" :placeholder="$t('m.defaultSqlPathPlaceholder')" @change="saveSetting">
                <template #prepend><span class="setting-label">{{$t('m.defaultSqlPath')}}</span></template>
                <template #append>
                  <el-button @click="selectDefaultSqlPath">{{$t('m.select')}}</el-button>
                </template>
              </el-input>
            </div>
          </el-col>
          <el-col :span="24">
            <div class="setting-line">
              <el-input v-model="setting.blacklistPath" :placeholder="$t('m.blacklistPathPlaceholder') || '默认路径（留空使用程序数据目录）'" @change="saveSetting">
                <template #prepend><span class="setting-label">黑名单路径</span></template>
                <template #append>
                  <el-button @click="selectBlacklistPath">{{$t('m.select')}}</el-button>
                </template>
              </el-input>
            </div>
          </el-col>
          <el-col :span="24">
            <div class="setting-line">
              <el-input v-model="setting.imageExplorer" @change="saveSetting">
                <template #prepend><span class="setting-label">{{$t('m.imageViewer')}}</span></template>
                <template #append>
                  <el-button @click="selectImageExplorerPath">{{$t('m.select')}}</el-button>
                </template>
              </el-input>
            </div>
          </el-col>
          <el-col :span="24">
            <div class="setting-line">
              <el-input class="label-input">
                <template #prepend><span class="setting-label">{{$t('m.theme')}}</span></template>
                <template #append>
                  <el-select placeholder=" " v-model="setting.theme" @change="handleThemeChange">
                    <el-option label="Default Dark" value="dark"></el-option>
                    <el-option label="Default Light" value="light"></el-option>
                    <el-option label="ExHentai" value="dark exhentai"></el-option>
                    <el-option label="E-Hentai" value="light e-hentai"></el-option>
                    <el-option label="nHentai" value="dark nhentai"></el-option>
                  </el-select>
                </template>
              </el-input>
            </div>
          </el-col>
          <el-col :span="24">
            <div class="setting-line">
              <el-input v-model="setting.igneous" @change="saveSetting">
                <template #prepend><span class="setting-label">igneous</span></template>
              </el-input>
            </div>
          </el-col>
          <el-col :span="24">
            <div class="setting-line">
              <el-input v-model="setting.ipb_pass_hash" @change="saveSetting">
                <template #prepend><span class="setting-label">ipb_pass_hash</span></template>
              </el-input>
            </div>
          </el-col>
          <el-col :span="24">
            <div class="setting-line">
              <el-input v-model="setting.ipb_member_id" @change="saveSetting">
                <template #prepend><span class="setting-label">ipb_member_id</span></template>
              </el-input>
            </div>
          </el-col>
          <el-col :span="24">
            <div class="setting-line">
              <el-input v-model="setting.star" @change="saveSetting">
                <template #prepend><span class="setting-label">star</span></template>
              </el-input>
            </div>
          </el-col>
          <el-col :span="24">
            <div class="setting-line">
              <el-input v-model="setting.proxy" @change="saveSetting"
                        :placeholder="$t('m.like') + ' http://127.0.0.1:7890'">
                <template #prepend><span class="setting-label">{{$t('m.proxy')}}</span></template>
                <template #append>
                  <el-button @click="testProxy">{{$t('m.test')}}</el-button>
                </template>
              </el-input>
            </div>
          </el-col>
        </el-row>
      </el-tab-pane>
      <el-tab-pane :label="$t('m.manageLibrary')" name="libraries">
        <el-row :gutter="8">
          <!-- Row: quick actions -->
          <el-col :span="24">
            <div class="setting-line">
              <el-form-item :label="$t('m.library')" class="lib-line" style="margin-right:auto">
                <el-button type="primary" style="margin-left:auto" size="small" plain @click="addLibraries">
                  {{$t('m.addFolder') || 'Add folders…'}}
                </el-button>
              </el-form-item>
            </div>
          </el-col>

          <!-- Row: list (sortable, removable) -->
          <el-table
              ref='libTableRef'
              :data="workingLibraries"
              max-height="260"
              border
              fit
              stripe
              highlight-current-row
              @current-change="onRowSelect"
          >
            <el-table-column type="index" label="#" width="40" class-name="col-index"/>

            <el-table-column :label="$t('m.path') || 'Path'" class-name="col-path">
              <template #default="{ row }">
                <el-tooltip :content="row.path" placement="top">
                  <span class="libpath">{{row.path}}</span>
                </el-tooltip>
              </template>
            </el-table-column>

            <el-table-column
                :label="$t('m.status') || 'Status'"
                width="90"
                fixed="right"
                class-name="col-right"
            >
              <template #default="{ row }">
                <el-tag v-if="row.exists" type="success" size="small" effect="light">
                  {{$t('m.exists') || 'Exists'}}
                </el-tag>
                <el-tag v-else type="warning" size="small" effect="light">
                  {{$t('m.missing') || 'Missing'}}
                </el-tag>
              </template>
            </el-table-column>

            <!-- Actions (flush right, far right) -->
            <el-table-column
                :label="$t('m.actions') || 'Actions'"
                width="90"
                fixed="right"
                class-name="col-right"
            >
              <template #default="{ $index }">
                <el-button size="small" type="danger" plain @click="removeAt($index)">
                  {{$t('m.remove') || 'Remove'}}
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <!-- Row: footer buttons -->
          <el-col :span="24">
            <div class="setting-line" style="display:flex; justify-content:flex-end; gap:8px; padding-top:10px">
              <el-button size="small" @click="openInOS" :disabled="!currentPath">
                {{$t('m.reveal') || 'Reveal in OS'}}
              </el-button>
              <el-button size="small" type="success" @click="saveLibraries">{{$t('m.save') || 'Save'}}</el-button>
            </div>
          </el-col>
        </el-row>
      </el-tab-pane>

      <el-tab-pane :label="$t('m.internalViewer')" name="internalViewer">
        <el-row :gutter="8">
          <el-col :span="24">
            <div class="setting-line">
              <el-input v-model.number="setting.thumbnailColumn" @change="saveSetting">
                <template #prepend><span class="setting-label">{{$t('m.thumbnailColumn')}}</span></template>
              </el-input>
            </div>
          </el-col>
          <el-col :span="24">
            <div class="setting-line">
              <el-input v-model.number="setting.widthLimit" :placeholder="$t('m.widthLimitInfo')" @change="saveSetting">
                <template #prepend><span class="setting-label">{{$t('m.widthLimit')}}</span></template>
              </el-input>
            </div>
          </el-col>
          <el-col :span="24" class="setting-switch">
            <el-switch
                v-model="setting.hidePageNumber"
                :active-text="$t('m.hidePageNumber')"
                @change="saveSetting"
            />
          </el-col>
          <el-col :span="24" class="setting-switch">
            <el-switch
                v-model="setting.keepReadingProgress"
                :active-text="$t('m.keepReadingProgress')"
                @change="saveSetting"
            />
          </el-col>
          <el-col :span="24" class="setting-switch">
            <el-switch
                v-model="setting.reverseLeftRight"
                :active-text="$t('m.reverseLeftRight')"
                @change="saveSetting"
            />
          </el-col>
          <el-col :span="24" class="setting-switch">
            <el-switch
                v-model="setting.autoNextManga"
                :active-text="$t('m.autoNextManga')"
                @change="saveSetting"
            />
          </el-col>
          <el-col :span="24" class="setting-switch">
            <el-switch
                v-model="setting.defaultInsertEmptyPage"
                :active-text="$t('m.defaultInsertEmptyPage')"
                @change="saveSetting"
            />
          </el-col>
          <el-col :span="24" class="setting-switch">
            <el-switch
                v-model="setting.deleteMode"
                :active-text="$t('m.deleteMode')"
                @change="saveSetting"
            />
          </el-col>
        </el-row>
      </el-tab-pane>
      <el-tab-pane :label="$t('m.collectTag')" name="collectTag">
        <el-row :gutter="8">
          <el-col :span="24" class="setting-line collect-tag">
            <el-form :inline="true" :model="formTagAdd" :show-message="false">
              <el-form-item :label="$t('m.tag')">
                <el-select-v2
                    v-model="formTagAdd.tag"
                    filterable clearable :height="340"
                    style="width: 500px"
                    :options="tagListForCollect"
                ></el-select-v2>
              </el-form-item>
              <el-form-item :label="$t('m.tagColor')">
                <el-select v-model="formTagAdd.colorMode" style="width: 120px" @change="updateTagColor">
                  <el-option label="自动" value="auto"></el-option>
                  <el-option label="随机" value="random"></el-option>
                  <el-option label="自定义" value="custom"></el-option>
                </el-select>
                <el-color-picker
                    v-if="formTagAdd.colorMode === 'custom'"
                    v-model="formTagAdd.color"
                    show-alpha
                    :predefine="moderateSoftColors"
                    style="margin-left: 8px"
                />
                <el-tag
                    v-else
                    :color="formTagAdd.color"
                    style="margin-left: 8px"
                >
                  预览颜色
                </el-tag>
              </el-form-item>
              <el-form-item>
                <el-button plain @click="addTagToCollect">{{$t('m.addTag')}}</el-button>
              </el-form-item>
            </el-form>
          </el-col>
          <el-col :span="24" class="setting-line collect-tag">
            <el-input
                v-model="collectTagSearch"
                placeholder="搜索收藏标签... (支持英文和中文翻译)"
                clearable
                style="width: 100%"
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>
          </el-col>
          <el-col :span="24" class="setting-line collect-tag">
            <template v-for="(category, categoryIndex) in groupedCollectTags" :key="category.name">
              <div class="category-group" v-if="category.tags.length > 0">
                <div class="category-header">
                  <span class="category-name">{{ category.name }}</span>
                  <span class="category-count">{{ category.tags.length }}</span>
                </div>
                <div class="category-tags">
                  <draggable
                      v-model="category.tags"
                      item-key="id"
                      animation="200"
                      group="collectTags"
                      @change="saveSetting"
                  >
                    <template #item="{element}">
                      <el-tag :color="element.color" effect="dark" closable @close="removeTag(element.id)">
                        {{element.letter}}:{{resolvedTranslation[element.tag]?.name || element.tag}}
                      </el-tag>
                    </template>
                  </draggable>
                </div>
              </div>
            </template>
          </el-col>
          <el-col :span="24" class="setting-switch">
            <el-switch
                v-model="setting.showCollectTag"
                :active-text="$t('m.showCollectTag')"
                @change="saveSetting"
            />
          </el-col>
          <el-col :span="24" class="setting-switch">
            <el-switch
                v-model="setting.highlightCreatorTag"
                :active-text="$t('m.highlightCreatorTag')"
                @change="saveSetting"
            />
          </el-col>
          <el-col :span="24" class="setting-switch">
            <el-switch
                v-model="setting.showChineseTranslation"
                :active-text="$t('m.showChineseTranslation')"
                @change="saveSetting"
            />
          </el-col>
        </el-row>
      </el-tab-pane>
      <el-tab-pane :label="$t('m.advanced')" name="advanced">
        <el-row :gutter="8">
          <el-col :span="24">
            <div class="setting-line">
              <el-input class="label-input">
                <template #prepend><span class="setting-label">{{$t('m.language')}}</span></template>
                <template #append>
                  <el-select placeholder=" " v-model="setting.language" @change="handleLanguageChange">
                    <el-option :label="$t('m.systemDefault')" value="default"></el-option>
                    <el-option label="zh-CN" value="zh-CN"></el-option>
                    <el-option label="zh-TW" value="zh-TW"></el-option>
                    <el-option label="en-US" value="en-US"></el-option>
                  </el-select>
                </template>
              </el-input>
            </div>
          </el-col>
          <el-col :span="24">
            <div class="setting-line">
              <el-input class="label-input">
                <template #prepend><span class="setting-label">{{$t('m.directEnter')}}</span></template>
                <template #append>
                  <el-select placeholder=" " v-model="setting.directEnter" @change="saveSetting">
                    <el-option :label="$t('m.detailPage')" value="detail"></el-option>
                    <el-option :label="$t('m.internalViewer')" value="internalViewer"></el-option>
                    <el-option :label="$t('m.externalViewer')" value="externalViewer"></el-option>
                  </el-select>
                </template>
              </el-input>
            </div>
          </el-col>
          <el-col :span="24">
            <div class="setting-line">
              <el-input class="label-input">
                <template #prepend><span class="setting-label">{{$t('m.displayTitle')}}</span></template>
                <template #append>
                  <el-select :placeholder="$t('m.displayTitleInfo')" v-model="setting.displayTitle"
                             @change="saveSetting">
                    <el-option :label="$t('m.englishTitle')" value="englishTitle"></el-option>
                    <el-option :label="$t('m.japaneseTitle')" value="japaneseTitle"></el-option>
                    <el-option :label="$t('m.filename')" value="filename"></el-option>
                  </el-select>
                </template>
              </el-input>
            </div>
          </el-col>
          <el-col :span="24">
            <div class="setting-line">
              <el-input class="label-input">
                <template #prepend><span class="setting-label">{{$t('m.defaultScraper')}}</span></template>
                <template #append>
                  <el-select v-model="setting.defaultScraper" @change="saveSetting">
                    <el-option v-for="searchType in searchTypeList" :key="searchType.value" :label="searchType.label"
                               :value="searchType.value"/>
                  </el-select>
                </template>
              </el-input>
            </div>
          </el-col>
          <el-col :span="24">
            <div class="setting-line">
              <el-input v-model.number="setting.requireGap" :placeholder="$t('m.requireGapInfo')" @change="saveSetting">
                <template #prepend><span class="setting-label">{{$t('m.requestGap')}}</span></template>
              </el-input>
            </div>
          </el-col>
          <el-col :span="24">
            <NameFormItem class="setting-line" prependWidth="110px">
              <template #prepend>{{$t('m.customOptions')}}</template>
              <template #default>
                <el-input
                    v-model="setting.customOptions" :placeholder="$t('m.customOptionsPlaceholder')"
                    @change="saveSetting"
                    type="textarea" :autosize="{ minRows: 2, maxRows: 4 }"
                ></el-input>
              </template>
            </NameFormItem>
          </el-col>
          <el-col :span="24">
            <div class="setting-line regexp">
              <el-input v-model="setting.trimTitleRegExp" :placeholder="$t('m.trimTitleRegExpInfo')"
                        @change="saveSetting">
                <template #prepend><span class="setting-label">{{$t('m.trimTitleRegExp')}}</span></template>
              </el-input>
            </div>
          </el-col>
          <el-col :span="24">
            <div class="setting-line">
              <el-input v-model="setting.searchKeySuffix" :placeholder="$t('m.searchKeySuffixInfo')"
                        @change="saveSetting">
                <template #prepend><span class="setting-label">{{$t('m.searchKeySuffix')}}</span></template>
              </el-input>
            </div>
          </el-col>
          <el-col :span="24">
            <div class="setting-line regexp">
              <el-input v-model="setting.excludeFile" :placeholder="$t('m.excludeFileInfo')" @change="saveSetting">
                <template #prepend><span class="setting-label">{{$t('m.excludeFile')}}</span></template>
                <template #append>
                  <el-popconfirm
                      placement="top-start"
                      :title="$t('m.applyExcludeRulesWarning')"
                      @confirm="applyExcludeRules"
                  >
                    <template #reference>
                      <el-button>{{$t('m.applyExcludeRules')}}</el-button>
                    </template>
                  </el-popconfirm>
                </template>
              </el-input>
            </div>
          </el-col>
          <el-col :span="24">
            <div class="setting-line">
              <el-input v-model="setting.folderTreeWidth" :placeholder="$t('m.folderTreeWidthInfo')"
                        @change="saveSetting">
                <template #prepend><span class="setting-label">{{$t('m.folderTreeWidth')}}</span></template>
              </el-input>
            </div>
          </el-col>
          <el-col :span="24">
            <NameFormItem class="setting-line" prependWidth="110px" appendWidth="0">
              <template #prepend>{{$t('m.customCss')}}</template>
              <template #default>
                <el-input
                    v-model="setting.customCss" :placeholder="$t('m.customCssPlaceholder')" @change="saveSetting"
                    type="textarea" :autosize="{ minRows: 2, maxRows: 4 }"
                ></el-input>
              </template>
              <template #append>
                <el-button text :icon="MdRefresh" @click="reloadWindow"></el-button>
              </template>
            </NameFormItem>
          </el-col>
          <!-- Concurrent Scan / Write (value on top, dropdown below) -->
          <el-col :span="24">
            <el-row :gutter="12">
              <!-- Left: concurrent scan -->
              <el-col :span="12">
                <div class="setting-line setting-line--concurrency">
                  <el-input class="label-input">
                    <template #prepend>
                      <span class="setting-label-wide">{{$t('m.concurrentScan')}} </span>
                    </template>
                    <template #append>
                      <el-select
                          v-model="setting.concurrentScan"
                          @change="saveSetting"
                          placeholder=" "
                          placement="bottom-start"
                          :fit-input-width="true"
                          :teleported="true"
                      >
                        <el-option
                            v-for="n in concurrencyOptionCeiling"
                            :key="'scan-' + n"
                            :label="n"
                            :value="n"
                        />
                      </el-select>
                    </template>
                  </el-input>
                </div>
              </el-col>

              <!-- Right: concurrent write -->
              <el-col :span="12">
                <div class="setting-line setting-line--concurrency">
                  <el-input class="label-input">
                    <template #prepend>
                      <span class="setting-label-wide">{{$t('m.concurrentWrite')}}</span>
                    </template>
                    <template #append>
                      <el-select
                          v-model="setting.concurrentWrite"
                          @change="saveSetting"
                          placeholder=" "
                          placement="bottom-start"
                          :fit-input-width="true"
                          :teleported="true"
                      >
                        <el-option
                            v-for="n in concurrencyOptionCeiling"
                            :key="'write-' + n"
                            :label="n"
                            :value="n"
                        />
                      </el-select>
                    </template>
                  </el-input>
                </div>
              </el-col>
            </el-row>
          </el-col>
          <el-col :span="8">
            <div class="setting-line">
              <el-checkbox v-model="setting.autoMatchOnRebuild" @change="saveSetting" style="margin-bottom: 8px;">
                {{$t('m.autoMatchOnRebuild')}}
              </el-checkbox>
              <el-popconfirm
                  placement="top-start"
                  :title="$t('m.rebuildWarning')"
                  @confirm="forceGeneBookList"
              >
                <template #reference>
                  <el-button class="function-button" plain>{{$t('m.rebuildLibrary')}}</el-button>
                </template>
              </el-popconfirm>
            </div>
          </el-col>
          <el-col :span="8">
            <div class="setting-line">
              <el-popconfirm
                  placement="top-start"
                  :title="$t('m.patchWarning')"
                  @confirm="patchLocalMetadata"
              >
                <template #reference>
                  <el-button class="function-button" type="primary" plain>{{$t('m.patchLocalMetadata')}}</el-button>
                </template>
              </el-popconfirm>
            </div>
          </el-col>
          <el-col :span="8">
            <div class="setting-line">
              <el-button class="function-button" type="primary" plain @click="exportDatabase">{{
                  $t('m.exportMetadata')
                }}
              </el-button>
            </div>
          </el-col>
          <el-col :span="8">
            <div class="setting-line">
              <el-button class="function-button" type="primary" plain @click="importDatabase">{{
                  $t('m.importMetadata')
                }}
              </el-button>
            </div>
          </el-col>
          <el-col :span="8">
            <div class="setting-line">
                <el-checkbox v-model="setting.matchTitleOnly" style="margin-right:12px">
                  仅用标题匹配（title/title_jpn）
                </el-checkbox>
                <el-checkbox v-model="setting.matchHash" style="margin-right:12px">
                  启用 hash 匹配
                </el-checkbox>
                <el-checkbox v-model="setting.fastMatch" style="margin-right:12px">
                  ⚡ 快速匹配模式
                </el-checkbox>
                <el-button class="function-button" type="primary" plain @click="importMetadataFromSqlite">{{
                    $t('m.importMetadataFromSqlite')
                  }}
                </el-button>
            </div>
          </el-col>
          <el-col :span="8">
            <div class="setting-line">
              <el-button class="function-button" type="danger" :icon="Delete"
                         :loading="busyRemove" :disabled="busyRemove" @click="removeMissingRecords"
              >{{$t('m.removeMissingRecords')}}
              </el-button>
            </div>
          </el-col>
          <el-col :span="8">
            <div class="setting-line">
              <el-button class="function-button" type="warning" plain @click="fillNoCategoryMetadata">
                {{$t('m.fillNoCategoryMetadata')}}
              </el-button>
            </div>
          </el-col>
          <el-col :span="8">
            <div class="setting-line">
              <el-button class="function-button" type="warning" plain @click="clearMatchBlacklist">
                清空匹配黑名单
              </el-button>
              <el-button class="function-button" type="info" plain @click="showBlacklistStats">
                查看黑名单
              </el-button>
            </div>
          </el-col>
          <el-col :span="8">
            <div class="setting-line">
              <el-button class="function-button" type="success" plain @click="showTitleIndexCacheStatus">
                📦 标题索引缓存
              </el-button>
              <el-button class="function-button" type="warning" plain @click="clearTitleIndexCache">
                清除缓存
              </el-button>
            </div>
          </el-col>
          <el-col :span="8">
            <div class="setting-line">
              <el-popconfirm
                  placement="top-start"
                  title="确定要清理所有文件夹类型的漫画吗？此操作不可撤销。"
                  @confirm="cleanFolderManga"
              >
                <template #reference>
                  <el-button class="function-button" type="danger" plain>
                    清理文件夹漫画
                  </el-button>
                </template>
              </el-popconfirm>
            </div>
          </el-col>
          <el-col :span="8">
            <div class="setting-line">
              <el-popconfirm
                  placement="top-start"
                  title="确定要修复缺失的封面吗？这将检查所有书籍并重新生成缺失的封面缩略图。"
                  @confirm="repairMissingCovers"
              >
                <template #reference>
                  <el-button class="function-button" type="primary" plain>
                    修复缺失封面
                  </el-button>
                </template>
              </el-popconfirm>
            </div>
          </el-col>
        </el-row>
        <el-row :gutter="8">
          <el-col :span="6" class="setting-switch">
            <el-switch
                v-model="setting.loadOnStart"
                :active-text="$t('m.onStartScan')"
                @change="saveSetting"
            />
          </el-col>
          <el-col :span="6" class="setting-switch">
            <el-switch
                v-model="setting.startOnLogin"
                :active-text="$t('m.startOnLogin')"
                @change="saveSetting"
            />
          </el-col>
          <el-col :span="6" class="setting-switch">
            <el-switch
                v-model="setting.autoCheckUpdates"
                :active-text="$t('m.autoCheckUpdates')"
                @change="saveSetting"
            />
          </el-col>
          <el-col :span="6" class="setting-switch">
            <el-switch
                v-model="setting.enabledLANBrowsing"
                :active-text="$t('m.enabledLANBrowsing')"
                @change="saveSetting"
            />
          </el-col>
          <el-col :span="12" class="setting-switch">
            <el-switch
                v-model="setting.batchTagfailedBook"
                :active-text="$t('m.batchTagfailedBook')"
                @change="saveSetting"
            />
          </el-col>
          <el-col :span="12" class="setting-switch">
            <el-switch
                v-model="setting.onlyGetMetadataOfSelectedFolder"
                :active-text="$t('m.onlyGetMetadataOfSelectedFolder')"
                @change="saveSetting"
            />
          </el-col>
          <el-col :span="6" class="setting-switch">
            <el-switch
                v-model="setting.showComment"
                :active-text="$t('m.showComment')"
                @change="saveSetting"
            />
          </el-col>
          <el-col :span="6" class="setting-switch">
            <el-switch
                v-model="setting.showTranslation"
                :active-text="$t('m.tagTranslate')"
                @change="handleTranslationSettingChange"
            />
          </el-col>
          <el-col :span="6" class="setting-switch">
            <el-switch
                v-model="setting.skipDeleteConfirm"
                :active-text="$t('m.skipDeleteConfirm')"
                @change="saveSetting"
            />
          </el-col>
          <el-col :span="6" class="setting-switch">
            <el-switch
                v-model="setting.disableRandomTag"
                :active-text="$t('m.disableRandomTag')"
                @change="saveSetting"
            />
          </el-col>
          <el-col :span="6" class="setting-switch">
            <el-switch
                v-model="setting.minimizeOnStart"
                :active-text="$t('m.minimizeOnStart')"
                @change="saveSetting"
            />
          </el-col>
          <el-col :span="6" class="setting-switch">
            <el-switch
                v-model="setting.minimizeToTray"
                :active-text="$t('m.minimizeToTray')"
                @change="saveSetting"
            />
          </el-col>
        </el-row>
      </el-tab-pane>
      <el-tab-pane :label="$t('m.translation')" name="translation">
        <el-row :gutter="8">
          <!-- 显示开关 -->
          <el-col :span="24">
            <div class="setting-line">
              <el-form-item :label="$t('m.translationSettings')">
                <el-switch
                    v-model="setting.showChineseTranslation"
                    :active-text="$t('m.showChineseTranslation')"
                    @change="saveSetting"
                />
              </el-form-item>
            </div>
          </el-col>

          <!-- 自动补缺 -->
          <el-col :span="24">
            <div class="setting-line">
              <el-form-item>
                <el-switch
                    v-model="setting.autoTranslateMissing"
                    :active-text="$t('m.autoTranslateMissing')"
                    @change="saveSetting"
                />
              </el-form-item>
            </div>
          </el-col>

          <!-- 排除纯数字和中文文件 -->
          <el-col :span="24">
            <div class="setting-line">
              <el-form-item>
                <el-switch
                    v-model="setting.excludePureNumberChinese"
                    :active-text="$t('m.excludePureNumberChinese')"
                    @change="saveSetting"
                />
              </el-form-item>
            </div>
          </el-col>

          <el-divider />

          <!-- API 配置标题 -->
          <el-col :span="24">
            <h3>{{ $t('m.aiApiConfig') }}</h3>
          </el-col>

          <!-- API Provider 选择 -->
          <el-col :span="24">
            <div class="setting-line">
              <el-select
                  v-model="setting.aiApiProvider"
                  :placeholder="$t('m.selectApiProvider')"
                  @change="saveSetting"
                  style="width: 100%"
              >
                <template #prepend>
                  <span class="setting-label">{{ $t('m.apiProvider') }}</span>
                </template>
                <el-option label="OpenRouter" value="openrouter" />
                <el-option label="OpenAI" value="openai" />
                <el-option label="Claude" value="claude" />
                <el-option label="通义千问" value="qwen" />
                <el-option label="文心一言" value="ernie" />
                <el-option label="自定义" value="custom" />
              </el-select>
            </div>
          </el-col>

          <!-- API Key -->
          <el-col :span="24">
            <div class="setting-line">
              <el-input
                  v-model="setting.aiApiKey"
                  :placeholder="$t('m.enterApiKey')"
                  type="password"
                  show-password
                  @change="saveSetting"
              >
                <template #prepend>
                  <span class="setting-label">{{ $t('m.apiKey') }}</span>
                </template>
              </el-input>
            </div>
          </el-col>

          <!-- API Base URL (仅自定义时显示) -->
          <el-col :span="24" v-if="setting.aiApiProvider === 'custom'">
            <div class="setting-line">
              <el-input
                  v-model="setting.aiApiBaseUrl"
                  :placeholder="$t('m.enterApiBaseUrl')"
                  @change="saveSetting"
              >
                <template #prepend>
                  <span class="setting-label">{{ $t('m.apiBaseUrl') }}</span>
                </template>
              </el-input>
            </div>
          </el-col>

          <!-- Model Name -->
          <el-col :span="24">
            <div class="setting-line">
              <el-input
                  v-model="setting.aiModel"
                  :placeholder="$t('m.enterModelName')"
                  @change="saveSetting"
              >
                <template #prepend>
                  <span class="setting-label">{{ $t('m.modelName') }}</span>
                </template>
              </el-input>
            </div>
          </el-col>

          <!-- Temperature -->
          <el-col :span="24">
            <div class="setting-line">
              <el-form-item :label="$t('m.temperature') + ': ' + (setting.aiTemperature || 0.3)">
                <el-slider
                    v-model="setting.aiTemperature"
                    :min="0"
                    :max="1"
                    :step="0.1"
                    @change="saveSetting"
                    style="margin-top: 10px"
                />
              </el-form-item>
            </div>
          </el-col>

          <!-- Max Tokens -->
          <el-col :span="24">
            <div class="setting-line">
              <el-input-number
                  v-model="setting.aiMaxTokens"
                  :min="10"
                  :max="500"
                  :step="10"
                  @change="saveSetting"
                  style="width: 100%"
              >
                <template #prepend>
                  <span class="setting-label">{{ $t('m.maxTokens') }}</span>
                </template>
              </el-input-number>
            </div>
          </el-col>

          <!-- Batch Translation Size -->
          <el-col :span="24">
            <div class="setting-line">
              <el-input-number
                  v-model="setting.batchTranslationSize"
                  :min="1"
                  :max="50"
                  :step="1"
                  @change="saveSetting"
                  style="width: 100%"
              >
                <template #prepend>
                  <span class="setting-label">{{ $t('m.batchTranslationSize') || '批量翻译数量' }}</span>
                </template>
              </el-input-number>
            </div>
          </el-col>

          <el-divider />

          <!-- 测试 API 连接 -->
          <el-col :span="24">
            <div class="setting-line">
              <el-button
                  type="primary"
                  @click="testApiConnection"
                  :loading="testingApi"
                  style="width: 100%"
              >
                {{ $t('m.testApiConnection') }}
              </el-button>
            </div>
          </el-col>

          <!-- 编辑 API 配置文件 -->
          <el-col :span="24">
            <div class="setting-line">
              <el-button
                  type="info"
                  @click="openApiConfigFile"
                  style="width: 100%"
              >
                {{ $t('m.editApiConfig') || '编辑 API 配置文件' }}
              </el-button>
            </div>
          </el-col>

          <!-- 批量翻译 -->
          <el-col :span="24">
            <div class="setting-line">
              <el-button
                  type="success"
                  @click="batchTranslate"
                  :loading="batchTranslating"
                  style="width: 100%"
              >
                {{ $t('m.batchTranslateAll') }}
              </el-button>
            </div>
          </el-col>

          <!-- 帮助信息 -->
          <el-col :span="24">
            <el-alert
                :title="$t('m.translationHelp')"
                type="info"
                :closable="false"
                show-icon
            >
              <template #default>
                <p>{{ $t('m.translationHelpText1') }}</p>
                <p>{{ $t('m.translationHelpText2') }}</p>
                <p>{{ $t('m.translationHelpText3') }}</p>
                <p><strong>{{ $t('m.batchTranslationSizeHelp') || '批量翻译数量：' }}</strong>{{ $t('m.batchTranslationSizeHelpText') || '每次API调用翻译的书籍数量。较大的值可以提高速度但可能超出API限制，建议值：5-20' }}</p>
              </template>
            </el-alert>
          </el-col>
        </el-row>
      </el-tab-pane>
      <el-tab-pane :label="$t('m.accelerator')" name="accelerator">
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
      </el-tab-pane>
      <el-tab-pane :label="$t('m.about')" name="about">
        <el-descriptions :column="1">
          <el-descriptions-item :label="$t('m.appName')+':'">exhentai-manga-manager</el-descriptions-item>
          <el-descriptions-item :label="$t('m.version')+':'">
            <a href="#"
               @click="openLink('https://github.com/SchneeHertz/exhentai-manga-manager/releases')">{{version}}</a>
          </el-descriptions-item>
          <el-descriptions-item :label="$t('m.appPage')+':'">
            <a href="#" @click="openLink('https://github.com/SchneeHertz/exhentai-manga-manager')">github</a>
          </el-descriptions-item>
          <el-descriptions-item :label="$t('m.help')+':'">
            <a v-if="['zh-CN', 'zh-TW'].includes($i18n.locale)" href="#"
               @click="openLink('https://github.com/SchneeHertz/exhentai-manga-manager/wiki/中文说明')">github wiki</a>
            <a v-else href="#"
               @click="openLink('https://github.com/SchneeHertz/exhentai-manga-manager/wiki/English-Instruction')">github
              wiki</a>
          </el-descriptions-item>
          <el-descriptions-item :label="$t('m.donation')+':'">
            <a v-if="['zh-CN', 'zh-TW'].includes($i18n.locale)" href="#"
               @click="openLink('https://afdian.com/a/SeldonHorizon')">爱发电</a>
            <a v-else href="#" @click="openLink('https://www.buymeacoffee.com/schneehertz')">buy me a coffee</a>
          </el-descriptions-item>
        </el-descriptions>
        <img src="/icon.png" class="about-logo">
        <el-row>
          <el-col :span="4" :offset="10">
            <div class="setting-line">
              <el-button class="function-button" type="primary" plain @click="autoCheckUpdates(true)">{{
                  $t('m.checkUpdates')
                }}
              </el-button>
            </div>
          </el-col>
        </el-row>
      </el-tab-pane>
    </el-tabs>
  </el-dialog>
</template>

<script setup>
import { ref, onMounted, h, computed, watch, watchEffect, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Search } from '@element-plus/icons-vue'
import draggable from 'vuedraggable'
import { MdRefresh } from '@vicons/ionicons4'

import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import zhTw from 'element-plus/dist/locale/zh-tw.mjs'
import en from 'element-plus/dist/locale/en.mjs'

import { version } from '../../package.json'
import { gh_token } from '../../secret_key.json'
import { acceleratorInfo } from '../utils.js'
import NameFormItem from './NameFormItem.vue'

import { storeToRefs } from 'pinia'
import { useAppStore } from '../pinia.js'

const appStore = useAppStore()
const { searchTypeList, setting, bookList, resolvedTranslation, localeFile, tagListRaw } = storeToRefs(appStore)
const { printMessage } = appStore

const { t, locale } = useI18n()
const dialogVisibleSetting = ref(false)
const activeSettingPanel = ref('general')

const emit = defineEmits([
  'loadBookList',
  'loadCollectionList',
])

// 收藏标签搜索
const collectTagSearch = ref('')

// Translation API testing state
const testingApi = ref(false)
const batchTranslating = ref(false)
const batchProgress = ref({ current: 0, total: 0 })

// Open API config file for editing
const openApiConfigFile = async () => {
  try {
    const result = await ipcRenderer.invoke('open-api-config-file')
    if (result.success) {
      ElMessage.success(t('m.apiConfigOpened') || 'API配置文件已打开，编辑后请重启应用')
    } else {
      ElMessage.error((t('m.apiConfigOpenFailed') || '打开配置文件失败') + ': ' + result.error)
    }
  } catch (e) {
    ElMessage.error((t('m.apiConfigOpenFailed') || '打开配置文件失败') + ': ' + e.message)
  }
}

// Test API connection
const testApiConnection = async () => {
  try {
    testingApi.value = true
    const result = await ipcRenderer.invoke('test-translation-api')
    if (result.success) {
      ElMessage.success(t('m.apiTestSuccess') || 'API test successful')
    } else {
      ElMessage.error((t('m.apiTestFailed') || 'API test failed') + ': ' + result.message)
    }
  } catch (e) {
    ElMessage.error((t('m.apiTestFailed') || 'API test failed') + ': ' + e.message)
  } finally {
    testingApi.value = false
  }
}

// Batch translate all books without translation
const batchTranslate = async () => {
  try {
    batchTranslating.value = true
    batchProgress.value = { current: 0, total: 0 }
    
    console.log('[Translation] Starting batch translation...')
    
    // Get all books that need translation
    const booksToTranslate = bookList.value.filter(book => {
      // Check if already has translation
      const hasTranslation = resolvedTranslation.value[book.hash]
      return !hasTranslation
    })
    
    console.log(`[Translation] Found ${booksToTranslate.length} books without translation`)
    
    if (booksToTranslate.length === 0) {
      ElMessage.info(t('m.noBookNeedsTranslation') || 'No books need translation')
      return
    }
    
    // Extract only necessary fields to avoid cloning issues
    const simplifiedBooks = booksToTranslate.map(book => {
      // Extract filename from filepath for display and filtering
      const filepath = book.filepath || ''
      const filename = filepath.split(/[\\/]/).pop() || filepath
      
      return {
        hash: book.hash,
        title: book.title,
        title_jpn: book.title_jpn,
        filepath: filepath,
        filename: filename,
        url: book.url || ''  // 添加URL字段以支持URL分组排序
      }
    })
    
    console.log('[Translation] Simplified book data:', simplifiedBooks.length, 'books')
    console.log('[Translation] Sample book:', simplifiedBooks[0])
    
    // Extract only necessary settings to avoid cloning issues
    const simplifiedSettings = {
      excludePureNumberChinese: setting.value.excludePureNumberChinese,
      trimTitleRegExp: setting.value.trimTitleRegExp,  // 添加标题裁剪正则表达式
      aiApiProvider: setting.value.aiApiProvider,
      aiApiKey: setting.value.aiApiKey,
      aiApiBaseUrl: setting.value.aiApiBaseUrl,
      aiModel: setting.value.aiModel,
      aiTemperature: setting.value.aiTemperature,
      aiMaxTokens: setting.value.aiMaxTokens,
      batchTranslationSize: setting.value.batchTranslationSize || 10
    }
    
    console.log('[Translation] Simplified settings:', simplifiedSettings)
    
    // Listen for progress updates
    const progressHandler = (event, progress) => {
      console.log(`[Translation Progress] ${progress.current}/${progress.total} - ${progress.book.filename}`)
      batchProgress.value = progress
      ElMessage.info(`${t('m.translating') || 'Translating'}: ${progress.current}/${progress.total} - ${progress.book.filename}`)
    }
    ipcRenderer.on('batch-translate-progress', progressHandler)
    
    ElMessage.info((t('m.batchTranslateStarted') || 'Batch translation started') + `: ${booksToTranslate.length} books`)
    
    console.log('[Translation] Invoking batch-translate-books IPC...')
    const result = await ipcRenderer.invoke('batch-translate-books', {
      books: simplifiedBooks,
      settings: simplifiedSettings
    })
    console.log('[Translation] IPC result:', result)
    
    // Remove progress listener
    ipcRenderer.removeListener('batch-translate-progress', progressHandler)
    
    console.log('[Translation] Batch translation completed:', result)
    
    // Show errors in console if any
    if (result.errors && result.errors.length > 0) {
      console.error('[Translation] Errors during batch translation:', result.errors)
    }
    
    ElMessage.success(
      (t('m.batchTranslateComplete') || 'Batch translation complete') + 
      `\n${t('m.success') || 'Success'}: ${result.success}` +
      `\n${t('m.failed') || 'Failed'}: ${result.failed}` +
      `\n${t('m.skipped') || 'Skipped'}: ${result.skipped}`
    )
    
    // Reload book list to show new translations
    console.log('[Translation] Reloading book list...')
    emit('loadBookList')
  } catch (e) {
    console.error('[Translation] Batch translation error:', e)
    ElMessage.error((t('m.batchTranslateFailed') || 'Batch translation failed') + ': ' + e.message)
  } finally {
    batchTranslating.value = false
    batchProgress.value = { current: 0, total: 0 }
  }
}

// concurrent scan options; default is min(concurrencyOptionCeiling, 4)
const concurrencyOptionCeiling = Math.max(1, Number(navigator.hardwareConcurrency) || 4)
const defaultConcurrentScan = Math.min(concurrencyOptionCeiling, 4)
const defaultConcurrentWrite = Math.min(concurrencyOptionCeiling, 2)

const normalizeConcurrency = (v, fallback) => {
  const n = Number(v)
  return Number.isFinite(n) && n >= 1 && n <= concurrencyOptionCeiling ? Math.trunc(n) : fallback
}

onMounted(() => {
  ipcRenderer.invoke('load-setting').then(async (res) => {
    setting.value = res
    // set default value
    if (res.autoCheckUpdates === undefined) setting.value.autoCheckUpdates = true
    if (res.trimTitleRegExp ===
        undefined) setting.value.trimTitleRegExp = '^\\d+[-]?\\s*|\\s*(\\[[^\\]]*\\]|\\([^\\)]*\\)|【[^】]*】|（[^）]*）)\\s*'
    if (res.defaultScraper === undefined) setting.value.defaultScraper = 'exhentai'
    if (res.defaultInsertEmptyPage === undefined) setting.value.defaultInsertEmptyPage = true
    
    // Translation defaults
    if (res.showChineseTranslation === undefined) setting.value.showChineseTranslation = false
    if (res.autoTranslateMissing === undefined) setting.value.autoTranslateMissing = false
    if (res.excludePureNumberChinese === undefined) setting.value.excludePureNumberChinese = true
    if (res.aiApiProvider === undefined) setting.value.aiApiProvider = 'openrouter'
    if (res.aiApiKey === undefined) setting.value.aiApiKey = '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'
    if (res.aiModel === undefined) setting.value.aiModel = 'deepseek/deepseek-chat-v3.1:free'
    if (res.aiTemperature === undefined) setting.value.aiTemperature = 0.3
    if (res.aiMaxTokens === undefined) setting.value.aiMaxTokens = 100
    if (res.batchTranslationSize === undefined) setting.value.batchTranslationSize = 10
    setting.value.concurrentScan = normalizeConcurrency(res.concurrentScan, defaultConcurrentScan)
    setting.value.concurrentWrite = normalizeConcurrency(res.concurrentWrite, defaultConcurrentWrite)
    // libray folders
    const okPath = validateLibrariesShallow(setting.value.libraries)
    if (!okPath) {
      setting.value.libraries = []
    }
    saveSetting()

    // default action
    if (res.theme) changeTheme(res.theme)
    // another saveSetting inside, causing race json writing. The resulting setting.json will be {...}...}
    // we serialize saves in ipcRenderer.invoke('save-setting'
    handleLanguageChange(res.language)
    if (res.showTranslation) loadTranslationFromEhTagTranslation()
    if (res.autoCheckUpdates) autoCheckUpdates(false)
    if (res.enabledLANBrowsing) ipcRenderer.invoke('enable-LAN-browsing')
    if (res.customCss) electronFunction['insert-css'](res.customCss)

  })
})

/*          Library Folder Management
 * -------------------------------------------
 */
const workingLibraries = ref([])
const libTableRef = ref(null)
const libs = computed(() => setting.value.libraries || [])
const libHead = computed(() => libs.value.slice(0, 2)) // only show the first two
const libMoreCount = computed(() => Math.max(0, libs.value.length - libHead.value.length))

// verify the libraries setting is a list of paths
// Heuristic "looks like a path" (works for POSIX, Windows, UNC, ~)
function looksLikePath(s) {
  if (typeof s !== 'string') return false
  const t = s.trim()
  if (!t) return false

  // Accept home-relative
  if (t === '~' || t.startsWith('~/') || t.startsWith('~\\')) return true

  // Windows drive:  C:\ or C:/ ...
  if (/^[A-Za-z]:[\\/]/.test(t)) return true

  // UNC share: \\Server\Share\...  or //Server/Share/...
  if (/^(\\\\|\/\/)[^\\\/]+[\\\/][^\\\/]+/.test(t)) return true

  // POSIX absolute: /usr/lib ...
  if (/^\//.test(t)) return true

  // Fallback: treat as relative path if it has a separator and no obviously illegal chars
  // (keep this lenient since we aren't checking existence)
  if (
      /[\\/]/.test(t) &&                 // has at least one separator
      !/[<>:"|?*\u0000\r\n]/.test(t) && // avoid Windows-illegal and control chars
      !t.endsWith(':')                   // avoid bare "C:"
  ) return true

  return false
}

function validateLibrariesShallow(raw) {
  return Array.isArray(raw) && raw.every(s => {
    if (typeof s !== 'string') return false;
    const t = s.trim();
    return !!t && looksLikePath(t);
  });
}

// Folder tab
const currentPath = ref('')

// Switch tabs to the Libraries tab (adjust name to your actual tab key)
function openLibrariesTab() {
  try {
    activeSettingPanel.value = 'libraries'
  } catch (_) {
  }
}

async function addLibraries() {
  try {
    const path = await ipcRenderer.invoke('select-folder', t('m.library'))
    if (!path) return

    const list = workingLibraries.value || []
    const i = list.findIndex(x => x?.path === path)

    if (i >= 0) {
      // already there: mark as exists (useful if it was missing before)
      list[i] = { ...list[i], exists: true }
    } else {
      list.push({ path: path, exists: true })
    }
    workingLibraries.value = [...list]

  } catch (e) {
    ElMessage.error(e?.message || 'Failed to add folders')
  }
}

async function checkLibraryFoldersMissing(paths) {
  try {
    const res = await ipcRenderer.invoke('fs:exists-batch', paths) // [{ path, exists }]
    const existsByPath = new Map(res.map(x => [x.path, !!x.exists]))
    return paths.map(p => ({ path: p, exists: !!existsByPath.get(p) }))
  } catch {
    return paths.map(p => ({ path: p, exists: false }))
  }
}

function onRowSelect(row) {
  currentPath.value = row?.path || ''
}

function removeAt(i) {
  workingLibraries.value = (workingLibraries.value || []).filter((_, idx) => idx !== i)
}

function saveLibraries() {
  const paths = (workingLibraries.value || []).map(x => x.path)
  setting.value.libraries = Array.from(new Set(paths))
  saveSetting()
  ElMessage.success(t('m.saved') || 'Saved')
  dialogVisibleSetting.value = false
}

async function resetWorkingLibraries() {
  const paths = [...(setting.value.libraries || [])]
  workingLibraries.value = await checkLibraryFoldersMissing(paths)
}

async function openInOS() {
  if (currentPath.value) {
    await ipcRenderer.invoke('show-folder', currentPath.value)
  }
}

/** -------------------------------------------
 * Library Folder Management End
 */
const selectMetadataPath = () => {
  ipcRenderer.invoke('select-folder', t('m.metadataPath')).then(res => {
    setting.value.metadataPath = res
    saveSetting()
  })
}

const selectDefaultSqlPath = () => {
  ipcRenderer.invoke('select-file', t('m.defaultSqlPath'), [{ name: 'SQLite', extensions: ['sqlite', 'db'] }]).then(res => {
    if (res) {
      setting.value.defaultSqlPath = res
      saveSetting()
    }
  })
}

const selectImageExplorerPath = () => {
  ipcRenderer.invoke('select-file', t('m.imageViewer')).then(res => {
    if (res) {
      setting.value.imageExplorer = `"${res}"`
      saveSetting()
    }
  })
}

const loadTranslationFromEhTagTranslation = async () => {
  const resultObject = {}
  const translationCache = JSON.parse(localStorage.getItem('translationCache') || '{}')
  resolvedTranslation.value = translationCache
  ipcRenderer.invoke('update-tag-translation', translationCache)
  await fetch('https://github.com/EhTagTranslation/Database/releases/latest/download/db.text.json').then(res => res.json()).then(res => {
    const sourceTranslationDatabase = res.data
    _.forIn(sourceTranslationDatabase, cat => {
      _.forIn(cat.data, (value, key) => {
        resultObject[key] = _.pick(value, ['name', 'intro'])
      })
    })
    resolvedTranslation.value = resultObject
    ipcRenderer.invoke('update-tag-translation', resultObject)
    localStorage.setItem('translationCache', JSON.stringify(resultObject))
  }).catch((error) => {
    console.log(error)
    printMessage('warning', t('c.useTranslationCache'))
  })
}

const handleTranslationSettingChange = (val) => {
  if (val) {
    loadTranslationFromEhTagTranslation()
  } else {
    resolvedTranslation.value = {}
  }
  saveSetting()
}

const testProxy = async () => {
  await fetch('https://e-hentai.org').then((res) => {
    if (res.status === 200) {
      printMessage('success', t('c.proxyWorking'))
    } else {
      printMessage('error', `Error ${res.status}: ` + t('c.proxyNotWorking'))
    }
  }).catch((error) => {
    printMessage('error', t('c.proxyNotWorking'))
  })
}

const autoCheckUpdates = async (forceShowDialog) => {
  await fetch('https://api.github.com/repos/SchneeHertz/exhentai-manga-manager/releases/latest', {
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': 'Bearer ' + gh_token,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  }).then(res => res.json()).then(res => {
    const { tag_name, html_url, body } = res
    const skipVersion = localStorage.getItem('skipVersion')
    if (tag_name && tag_name !== 'v' + version && tag_name !== skipVersion) {
      ElMessageBox.confirm(
          h('pre', { innerHTML: body, style: 'font-family: Avenir, Helvetica, Arial, sans-serif' }),
          t('c.newVersion') + tag_name,
          {
            distinguishCancelAndClose: true,
            confirmButtonText: t('c.downloadUpdate'),
            cancelButtonText: t('c.skipVersion'),
          },
      ).then(() => {
        ipcRenderer.invoke('open-url', html_url)
      }).catch((action) => {
        if (action === 'cancel') {
          localStorage.setItem('skipVersion', tag_name)
        }
      })
    } else if (forceShowDialog) {
      ElMessageBox.confirm(
          t('c.notNewVersion'),
          {
            type: 'info',
            showCancelButton: false,
          },
      )
    }
  })
}

const handleThemeChange = (val) => {
  changeTheme(val)
  saveSetting()
}
const changeTheme = (classValue) => {
  document.documentElement.setAttribute('class', classValue)
}
const handleLanguageChange = (val) => {
  ipcRenderer.invoke('get-locale').then(localeString => {
    let languageCode
    if (!val || (val === 'default')) {
      languageCode = localeString
    } else {
      languageCode = val
    }
    handleLanguageSet(languageCode)
    saveSetting()
  })
}

const saveSetting = () => {
  ipcRenderer.invoke('save-setting', _.cloneDeep(setting.value))
}

const openLink = (link) => {
  ipcRenderer.invoke('open-url', link)
}

const forceGeneBookList = async () => {
  dialogVisibleSetting.value = false
  localStorage.setItem('viewerReadingProgress', JSON.stringify([]))
  bookList.value = await ipcRenderer.invoke('force-gene-book-list')
  emit('loadCollectionList')
  printMessage('success', t('c.rebuildMessage'))
}

const applyExcludeRules = async () => {
  try {
    const result = await ipcRenderer.invoke('apply-exclude-rules')
    if (result.success) {
      if (result.removedCount > 0) {
        printMessage('success', t('c.applyExcludeRulesSuccess', { count: result.removedCount }))
        // Reload book list to reflect changes
        emit('loadBookList')
      } else {
        printMessage('info', t('c.applyExcludeRulesNoMatch'))
      }
    } else {
      printMessage('error', t('c.applyExcludeRulesError') + ': ' + result.message)
    }
  } catch (e) {
    console.error('Apply exclude rules error:', e)
    printMessage('error', t('c.applyExcludeRulesError') + ': ' + e.message)
  }
}

const patchLocalMetadata = async () => {
  await ipcRenderer.invoke('patch-local-metadata')
  emit('loadBookList')
}
const handleLanguageSet = (languageCode) => {
  switch (languageCode) {
    case 'zh-CN':
      localeFile.value = zhCn
      locale.value = 'zh-CN'
      break
    case 'zh-TW':
      localeFile.value = zhTw
      locale.value = 'zh-TW'
      break
    case 'en-US':
    default:
      localeFile.value = en
      locale.value = 'en-US'
      break
  }
}

const exportDatabase = async () => {
  const folder = await ipcRenderer.invoke('select-folder', t('c.exportFolder'))
  const result = await ipcRenderer.invoke('export-database', folder)
  if (result) printMessage('success', t('c.exportMessage'))
}

const importDatabase = async () => {
  const collectionListPath = await ipcRenderer.invoke('select-file', t('c.selectCollectionList'),
      [{ name: 'JSON', extensions: ['json'] }])
  const metadataSqlitePath = await ipcRenderer.invoke('select-file', t('c.selectMetadataSqlite'),
      [{ name: 'SQLite', extensions: ['sqlite'] }])
  await ipcRenderer.invoke('import-database', { collectionListPath, metadataSqlitePath })
}

const importMetadataFromSqlite = async () => {
  const matchOptions = {
    matchTitleOnly: setting.value.matchTitleOnly,
    matchHash: setting.value.matchHash,
    fastMatch: setting.value.fastMatch,
    trimTitleRegExp: setting.value.trimTitleRegExp  // 传递裁剪标题正则表达式
  }
  // 只传递未标记的书籍，避免不必要的遍历
  const untaggedBooks = bookList.value.filter(book => book.status !== 'tagged')
  const { success, matched, blacklisted, processed, skipped } = await ipcRenderer.invoke('import-sqlite', {
    bookList: _.cloneDeep(untaggedBooks),
    matchOptions
  })
  if (success) {
    // 重新加载书籍列表，避免传输大量数据
    await ipcRenderer.invoke('load-book-list').then(res => {
      bookList.value = res
    })
    const skipMsg = skipped > 0 ? `, 跳过已标记:${skipped}` : ''
    printMessage('success', t('c.importMessage') + ` (匹配:${matched}, 新增黑名单:${blacklisted}, 处理:${processed}${skipMsg})`)
    emit('loadBookList')
  } else {
    printMessage('info', t('c.canceled'))
  }
}

const fillNoCategoryMetadata = async () => {
  try {
    // 检查书籍是否有标签
    const hasNoTags = (book) => {
      if (!book.tags) return true
      // 检查所有标签类别是否都为空
      const tagCategories = ['language', 'parody', 'character', 'group', 'artist', 'male', 'female', 'mixed', 'other', 'cosplayer', 'rest']
      return tagCategories.every(cat => !book.tags[cat] || book.tags[cat].length === 0)
    }
    
    // 筛选出：1) 无分类的书籍 OR 2) 有分类但无标签的书籍
    const noCategoryBooks = bookList.value.filter(book => {
      if (book.status !== 'tagged') return false
      
      const noCategory = !book.category || book.category === '' || book.category === 'Misc'
      const noTags = hasNoTags(book)
      
      return noCategory || noTags
    })
    
    if (noCategoryBooks.length === 0) {
      printMessage('info', t('c.noBooksToFill'))
      return
    }
    
    // 只传递必要的字段，避免克隆错误
    const simpleBookList = noCategoryBooks.map(book => ({
      id: book.id,
      title: book.title,
      title_jpn: book.title_jpn,
      filepath: book.filepath,
      type: book.type,
      hash: book.hash,
      url: book.url,
      status: book.status,
      category: book.category
    }))
    
    printMessage('info', t('c.startFillingNoCategory', { count: noCategoryBooks.length }))
    
    const result = await ipcRenderer.invoke('fill-no-category-metadata', simpleBookList)
    
    if (result.success) {
      printMessage('success', t('c.fillNoCategoryComplete', { 
        success: result.successCount, 
        failed: result.failedCount,
        total: noCategoryBooks.length 
      }))
      // 重新加载书籍列表以更新UI
      emit('loadBookList')
    } else {
      printMessage('error', t('c.fillNoCategoryFailed', { error: result.error }))
    }
  } catch (error) {
    printMessage('error', t('c.fillNoCategoryFailed', { error: error.message }))
    console.error('Fill no-category metadata error:', error)
  }
}

const selectBlacklistPath = async () => {
  const folder = await ipcRenderer.invoke('select-folder', '选择黑名单存储文件夹')
  if (folder) {
    setting.value.blacklistPath = folder
    await saveSetting()
  }
}

const clearMatchBlacklist = async () => {
  try {
    await ElMessageBox.confirm(
      '此操作将清空所有匹配失败的黑名单记录，下次导入时会重新尝试匹配这些项目。是否继续？',
      '清空匹配黑名单',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    const { success, path } = await ipcRenderer.invoke('clear-match-blacklist')
    if (success) {
      printMessage('success', `已清空黑名单文件: ${path}`)
    } else {
      printMessage('error', '清空黑名单失败')
    }
  } catch (e) {
    if (e !== 'cancel') {
      printMessage('error', '清空黑名单失败: ' + e.message)
    }
  }
}

const showBlacklistStats = async () => {
  try {
    const { success, count, path } = await ipcRenderer.invoke('get-blacklist-stats')
    if (success) {
      ElMessageBox.alert(
        `黑名单项目数: ${count}\n文件路径: ${path}`,
        '黑名单统计',
        {
          confirmButtonText: '确定',
          type: 'info'
        }
      )
    } else {
      printMessage('error', '获取黑名单统计失败')
    }
  } catch (e) {
    printMessage('error', '获取黑名单统计失败: ' + e.message)
  }
}

// 显示标题索引缓存状态
const showTitleIndexCacheStatus = async () => {
  try {
    const result = await ipcRenderer.invoke('get-title-index-cache-status')
    if (result.success) {
      if (result.cached) {
        const message = `📦 缓存状态: 有效
📊 标题数量: ${result.titleCount.toLocaleString()}
📁 数据库: ${result.dbPath}
⏱️ 已缓存: ${result.ageMinutes} 分钟
⏳ 剩余时间: ${result.remainingMinutes} 分钟`
        
        ElMessageBox.alert(message, '标题索引缓存状态', {
          confirmButtonText: '确定',
          type: 'success'
        })
      } else {
        ElMessageBox.alert(
          '当前无缓存，首次导入时会自动缓存\n缓存有效期：2小时',
          '标题索引缓存状态',
          {
            confirmButtonText: '确定',
            type: 'info'
          }
        )
      }
    } else {
      printMessage('error', '获取缓存状态失败: ' + result.error)
    }
  } catch (e) {
    printMessage('error', '获取缓存状态失败: ' + e.message)
  }
}

// 清除标题索引缓存
const clearTitleIndexCache = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要清除标题索引缓存吗？\n下次导入时会重新加载索引（约8秒）',
      '确认清除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    const { success } = await ipcRenderer.invoke('clear-title-index-cache')
    if (success) {
      printMessage('success', '已清除标题索引缓存')
    } else {
      printMessage('error', '清除缓存失败')
    }
  } catch (e) {
    if (e !== 'cancel') {
      printMessage('error', '清除缓存失败: ' + e.message)
    }
  }
}

const cleanFolderManga = async () => {
  try {
    printMessage('info', '正在清理文件夹类型漫画...')
    const result = await ipcRenderer.invoke('clean-folder-manga')
    if (result.success) {
      printMessage('success', `已清理 ${result.count} 个文件夹类型漫画`)
      // 刷新列表
      emit('loadBookList')
    } else {
      printMessage('error', '清理失败: ' + (result.error || '未知错误'))
    }
  } catch (e) {
    printMessage('error', '清理失败: ' + e.message)
  }
}

const busyRemove = ref(false)
const removeMissingRecords = async () => {
  const ipc = window.electron?.ipcRenderer ?? window.ipcRenderer
  if (!ipc) {
    // just in case
    ElMessage.error('IPC not available')
    return
  }
  busyRemove.value = true
  try {
    // 1) Dry run — get counts
    const { totalRows, missingFileCount, missingCoverCount } =
        await ipc.invoke('remove-missing-records')

    let mainFreeMB, mainPct, metaFreeMB, metaPct = null

    try {
      const est = await ipc.invoke('sqlite-vacuum-estimate') // optional IPC
      if (est?.main) {
        mainFreeMB = String(est.main.freeMB)           // already MB
        mainPct = est.main.freeRatio != null ? String((est.main.freeRatio * 100).toFixed(1)) : null
      }
      if (est?.meta) {
        metaFreeMB = String(est.meta.freeMB)
        metaPct = est.meta.freeRatio != null ? String((est.meta.freeRatio * 100).toFixed(1)) : null
      }
    } catch { /* IPC not implemented — ignore */ }
    const pieces = []
    if (mainFreeMB) pieces.push(`database.sqlite: ${mainFreeMB} MB ${mainPct ? ` (${mainPct}%)` : ''}`)
    if (metaFreeMB) pieces.push(`metadata.sqlite: ${metaFreeMB} MB ${metaPct ? ` (${metaPct}%)` : ''}`)
    const estimateText = pieces.length ? t('m.mayFree', { sizes: pieces.join(', ') }) : ''
    const vacuumLine = `
  <p style="margin-top:8px">
    <label style="display:flex;gap:8px;align-items:center">
      <input id="vacuumOpt" type="checkbox" />
      <span>
        ${t('m.vacuumAlso')}
        <span style="opacity:.8">${t('m.vacuumEstimate', { estimate: estimateText })}</span>
      </span>
    </label>
  </p>`


    // 2) Ask for confirmation
    const msg = `
  <div>
    <p>${t('m.confirmRemoveIntro')}</p>
    <ul style="margin:8px 0 0 18px;padding:0;line-height:1.6">
      <li>${t('m.totalRecordsScanned')}: <b>${totalRows}</b></li>
      <li>${t('m.missingFilesToRemove')}: <b>${missingFileCount}</b></li>
      <li>${t('m.unrefCoversToDelete')}: <b>${missingCoverCount}</b></li>
    </ul>
    <p style="margin-top:8px"><b>${t('m.noFilesDeleted')}</b></p>
    ${vacuumLine}
    <p style="opacity:.8">${t('m.actionIrreversible')}</p>
  </div>`

    let wantVacuum = false
    await ElMessageBox.confirm(msg, t('m.confirmRemoveTitle'), {
      dangerouslyUseHTMLString: true,
      type: 'warning',
      cancelButtonText: t('m.cancel'),
      confirmButtonText: t('m.remove'),
      // read checkbox before dialog closes
      beforeClose: (action, _instance, done) => {
        if (action === 'confirm') {
          const cb = document.getElementById('vacuumOpt')
          wantVacuum = !!cb?.checked
        }
        done()
      },
    })

    // 3) Execute cleanup
    const res = await ipc.invoke('remove-missing-records', { confirm: true, vacuum: wantVacuum })
    // res may include counts if you returned them; keep message simple:
    emit('loadBookList')
    ElMessage.success('Cleanup complete. Re-scanning...')
  } catch (err) {
    // ElMessageBox.confirm throws on cancel; swallow it quietly
  } finally {
    busyRemove.value = false
  }
}

const formTagAdd = ref({
  tag: null,
  color: '#42A5F5',
  colorMode: 'auto', // auto, random, custom
})

// 监听标签选择变化，自动更新颜色预览
watch(() => formTagAdd.value.tag, (newTagId) => {
  if (newTagId && formTagAdd.value.colorMode === 'auto') {
    const tag = tagListRaw.value.find(tag => tag.id === newTagId)
    if (tag) {
      formTagAdd.value.color = generateColorFromTag(tag.tag)
    }
  }
})

const tagListForCollect = computed(() => {
  if (setting.value.showTranslation) {
    return tagListRaw.value.map(({ letter, cat, tag, id }) => {
      const labelHeader = cat === 'group' ? '团队' : resolvedTranslation.value[cat]?.name || cat
      const labelTail = resolvedTranslation.value[tag]?.name || tag
      return {
        label: `${labelHeader}:${labelTail} || ${letter}:"${tag}"$`,
        value: id,
      }
    })
  } else {
    return tagListRaw.value.map(({ letter, cat, tag, id }) => {
      return {
        label: `${cat}:${tag} || ${letter}:"${tag}"$`,
        value: id,
      }
    })
  }
})

const groupedCollectTags = computed(() => {
  const groups = {}
  if (!setting.value.collectTag) return []

  // 过滤标签
  let filteredTags = setting.value.collectTag

  if (collectTagSearch.value.trim()) {
    const searchTerm = collectTagSearch.value.trim().toLowerCase()
    filteredTags = setting.value.collectTag.filter(tag => {
      // 搜索英文标签名
      const englishMatch = tag.tag.toLowerCase().includes(searchTerm)
      
      // 搜索中文翻译
      const chineseMatch = setting.value.showTranslation && 
        resolvedTranslation.value[tag.tag]?.name?.toLowerCase().includes(searchTerm)
      
      // 搜索类别
      const categoryMatch = tag.cat.toLowerCase().includes(searchTerm)
      
      // 搜索类别中文翻译
      const categoryChineseMatch = setting.value.showTranslation && 
        (tag.cat === 'group' ? '团队' : resolvedTranslation.value[tag.cat]?.name)?.toLowerCase().includes(searchTerm)
      
      return englishMatch || chineseMatch || categoryMatch || categoryChineseMatch
    })
  }

  filteredTags.forEach(tag => {
    const category = setting.value.showTranslation
      ? (tag.cat === 'group' ? '团队' : resolvedTranslation.value[tag.cat]?.name || tag.cat)
      : tag.cat

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
})

const moderateSoftColors = [
  '#FF6F61', // 略微柔和但鲜艳的珊瑚红
  '#F48FB1', // 鲜明的粉红色
  '#42A5F5', // 鲜艳的蓝色
  '#66BB6A', // 鲜艳的绿色
  '#FFCA28', // 亮黄色
  '#AB47BC', // 鲜亮的紫色
  '#26A69A', // 热带青色
  '#FFA726', // 鲜亮的橙色
  '#8D6E63', // 保存自然的棕色
  '#78909C',  // 鲜明的灰蓝色
]

// 根据标签名生成颜色的函数
const generateColorFromTag = (tagName) => {
  // 简单的hash函数
  let hash = 0
  for (let i = 0; i < tagName.length; i++) {
    const char = tagName.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // 转换为32位整数
  }

  // 使用hash生成颜色
  const hue = Math.abs(hash) % 360
  const saturation = 65 + (Math.abs(hash) % 20) // 65-85%
  const lightness = 45 + (Math.abs(hash >> 8) % 20) // 45-65%

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

// 获取随机颜色的函数
const getRandomColor = () => {
  const randomIndex = Math.floor(Math.random() * moderateSoftColors.length)
  return moderateSoftColors[randomIndex]
}

// 更新标签颜色的函数
const updateTagColor = () => {
  const tag = tagListRaw.value.find(tag => tag.id === formTagAdd.value.tag)
  if (!tag) return

  switch (formTagAdd.value.colorMode) {
    case 'auto':
      formTagAdd.value.color = generateColorFromTag(tag.tag)
      break
    case 'random':
      formTagAdd.value.color = getRandomColor()
      break
    case 'custom':
      // 保持用户选择的颜色
      break
  }
}

const addTagToCollect = () => {
  const tag = tagListRaw.value.find(tag => tag.id === formTagAdd.value.tag)
  if (!setting.value.collectTag) setting.value.collectTag = []
  
  // 根据模式生成颜色
  let finalColor = formTagAdd.value.color
  if (formTagAdd.value.colorMode === 'auto') {
    finalColor = generateColorFromTag(tag.tag)
  } else if (formTagAdd.value.colorMode === 'random') {
    finalColor = getRandomColor()
  }
  
  setting.value.collectTag.push({
    id: tag.id,
    letter: tag.letter,
    cat: tag.cat,
    tag: tag.tag,
    color: finalColor,
  })
  setting.value.collectTag = _.uniqBy(setting.value.collectTag, 'id')
  formTagAdd.value.tag = null
  saveSetting()
}

const removeTag = (id) => {
  setting.value.collectTag = setting.value.collectTag.filter(tag => tag.id !== id)
  saveSetting()
}

const reloadWindow = () => {
  window.location.reload()
}

const repairMissingCovers = async () => {
  try {
    printMessage('info', '开始修复缺失的封面...')
    const result = await ipcRenderer.invoke('repair-missing-covers')
    if (result && typeof result.repairedCount === 'number') {
      printMessage('success', `封面修复完成，共修复 ${result.repairedCount} 个缺失封面`)
      // 刷新书籍列表以显示新的封面
      emit('loadBookList')
    } else {
      printMessage('error', '封面修复失败')
    }
  } catch (e) {
    printMessage('error', '封面修复失败: ' + e.message)
  }
}

async function onSettingOpen() {
  await nextTick()
  await resetWorkingLibraries()
}

defineExpose({
  dialogVisibleSetting,
  activeSettingPanel,
  saveSetting,
})

</script>

<style lang="stylus">
.setting-title
  margin: 0
  text-align: center

.setting-line
  margin: 6px 0

  .el-input-group__prepend
    width: 110px

.setting-line.regexp
  .el-input__inner
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace

.setting-line.collect-tag
  .el-form-item
    margin-bottom: 0

  .el-tag
    margin-right: 8px
    margin-bottom: 8px
    border-width: 0

.setting-switch
  text-align: left
  margin-top: 6px

.label-input > .el-input__wrapper
  display: none

.label-input
  .el-input-group__append
    width: 77% // align the dropdown text placeholder (a breaking change after electron 30.0.0)
    background-color: transparent
    border-left: solid 1px var(--el-border-color)

    .el-select
      width: 100%

.about-logo
  width: 160px
  position: absolute
  right: 40px
  top: 10px

.setting-tabs
  .el-tabs__content
    max-height: 70vh
    overflow-y: auto
    padding-right: 10px


.setting-line--concurrency .label-input {
  width: 100%;
}

/* Align the right gray divider with the row above */
.setting-line--concurrency .label-input .el-input-group__prepend {
  width: var(--setting-label-width);
  flex: 0 0 var(--setting-label-width);
  max-width: var(--setting-label-width);

  box-sizing: border-box; /* include border in width calc */
  padding: 0 29px; /* mirror your other row’s padding */
  display: flex;
  align-items: center;

  /* ensure the divider exists/looks identical */
  border-right: 1px solid var(--el-border-color);
}

.setting-label-wide {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  /* add any special tweaks unique to this row here */
}

// library folders in the setting tab
/* 0) Make sure the hidden text input doesn't push layout */
.lib-input .el-input__inner {
  flex: 0 0 auto !important;
  width: 0 !important;
  padding: 0 !important;
  border: none !important;
}

/* 1) Let the suffix stretch and center its single child vertically */
.lib-input .el-input__suffix,
.lib-input .el-input__suffix-inner {
  display: flex;
  flex: 1 1 0%;
  min-width: 0;
  align-items: center; /* <-- center across the row height */
  justify-content: flex-start;
}

/* 2) Give the preview area a fixed visible height (≈ 2 tag rows) and
      center its content vertically */
.lib-preview {
  display: flex;
  align-items: center; /* <-- centers the .el-space block vertically */
  height: 33px; /* adjust to 56/64/72px to fit your tag size */
  width: 100%;
}

/* 3) The actual tag list (Element Plus <el-space>) — wrap rows, but
      do NOT stretch to full height so it can be centered by its parent */
.lib-preview .el-space {
  flex-wrap: wrap !important;
  align-items: center !important; /* center items within each row */
  gap: 8px !important;
  align-self: center; /* ensure the block participates in centering */
  justify-content: flex-start !important; /* <-- left start */
  /* no fixed height here */
  margin-left: 0 !important; /* guard against accidental centering */
}

.lib-input .el-input__suffix-inner > :first-child {
  margin-left: 0 !important;
}

/* (Optional) keep the Manage button aligned like other lines */
.lib-input .el-input-group__append {
  display: flex;
  align-items: center;
  padding: 0 18px;
}

.lib-preview .el-tag {
  max-width: 240px;
  --el-tag-font-size: 13px;
}

.lib-preview .el-tag__content {
  max-width: 100%;
}

/* cut off on one line with … */
.chunk-path {
  display: inline-block;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

// library tab
.libpath {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: bottom;
  white-space: nowrap;
}

.lib-line {
  display: flex;
  align-items: center;
  justify-content: space-between; /* label left, buttons right */
}

/* Button group spacing */
.el-form-item.lib-line {
  padding: 0;
  width: 100%;
}

.el-table .col-right .cell {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px; /* nice spacing if multiple items appear */
}

.el-table th.col-right > .cell {
  justify-content: center
}

/* Wrap long segments and paths nicely */
.el-table .col-path .libpath {
  display: inline;
  white-space: normal;
  word-break: break-word; /* fallback */
  overflow-wrap: anywhere; /* modern browsers */
  line-height: 1.2;
}

/* Optional: prevent the right-fixed columns from shrinking the path */
.el-table .col-path {
  min-width: 240px; /* adjust as needed */
}

.el-table .col-path .cell {
  display: block; /* break out of flex so text can wrap */
  white-space: normal; /* allow line breaks */
  overflow: visible;
}

/* Thicker left divider on the index column (header + body) */
.el-table th.col-index.el-table__cell,
.el-table td.col-index.el-table__cell {
  border-left-width: 5px; /* make it broader */
  border-left-style: solid;
  border-left-color: var(--el-border-color);
  /* optional: extra left padding to match the Actions side spacing */
  padding-left: 3px;
}

/* Collect tag category styles */
.category-group {
  margin-bottom: 12px;
}

.category-group:last-child {
  margin-bottom: 0;
}

.category-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  padding: 4px 8px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
}

.category-name {
  font-weight: 600;
  font-size: 12px;
  color: var(--el-text-color-primary);
}

.category-count {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  background: var(--el-border-color-light);
  padding: 2px 6px;
  border-radius: 10px;
}

.category-tags {
  padding-left: 4px;
}

</style>