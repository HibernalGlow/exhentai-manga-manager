<template>
  <div>
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
    </el-row>

    <!-- Advanced Button Groups -->
    <el-row :gutter="8">
      <el-col :span="8">
        <div class="setting-line advanced-button-group">
          <div class="button-row">
            <el-checkbox v-model="setting.autoMatchOnRebuild" @change="saveSetting" class="button-checkbox">
              {{$t('m.autoMatchOnRebuild')}}
            </el-checkbox>
          </div>
          <div class="button-row">
            <el-popconfirm
                placement="top-start"
                :title="$t('m.rebuildWarning')"
                @confirm="forceGeneBookList"
            >
              <template #reference>
                <el-button class="function-button advanced-button" plain>{{$t('m.rebuildLibrary')}}</el-button>
              </template>
            </el-popconfirm>
          </div>
        </div>
      </el-col>
      <el-col :span="8">
        <div class="setting-line advanced-button-group">
          <div class="button-row">
            <el-popconfirm
                placement="top-start"
                :title="$t('m.patchWarning')"
                @confirm="patchLocalMetadata"
            >
              <template #reference>
                <el-button class="function-button advanced-button" type="primary" plain>{{$t('m.patchLocalMetadata')}}</el-button>
              </template>
            </el-popconfirm>
          </div>
          <div class="button-row">
            <el-button class="function-button advanced-button" type="primary" plain @click="exportDatabase">{{
                $t('m.exportMetadata')
              }}
            </el-button>
          </div>
        </div>
      </el-col>
      <el-col :span="8">
        <div class="setting-line advanced-button-group">
          <div class="button-row">
            <el-button class="function-button advanced-button" type="success" plain @click="exportAiMatchedData">
              导出AI匹配数据
            </el-button>
          </div>
          <div class="button-row">
            <el-button class="function-button advanced-button" type="primary" plain @click="importDatabase">{{
                $t('m.importMetadata')
              }}
            </el-button>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- Matching Strategy -->
    <el-row :gutter="8">
      <el-col :span="8">
        <div class="setting-line">
          <div style="margin-bottom: 8px;">
            <el-collapse v-model="advancedCollapse" style="border:none;">
              <el-collapse-item name="1" style="border:none;">
                <template #title>
                  <strong style="color: var(--el-text-color-primary);">匹配策略</strong>
                </template>
                <div style="display: flex; flex-wrap: wrap; gap: 12px;">
                  <el-checkbox v-model="setting.matchTitleOnly" @change="saveSetting" style="margin-right: 0;">
                    仅用标题匹配（title/title_jpn）
                  </el-checkbox>
                  <el-checkbox v-model="setting.matchHash" @change="saveSetting" style="margin-right: 0;">
                    启用 hash 匹配
                  </el-checkbox>
                  <el-checkbox v-model="setting.matchSha1" @change="saveSetting" style="margin-right: 0;">
                    启用 SHA1 压缩包匹配
                  </el-checkbox>
                  <el-checkbox v-model="setting.fastMatch" @change="saveSetting" style="margin-right: 0;">
                    ⚡ 快速匹配模式
                  </el-checkbox>
                </div>
              </el-collapse-item>
            </el-collapse>
          </div>
          <div style="margin-top: 12px; display: flex; gap: 8px;">
            <el-button 
              class="function-button" 
              type="primary" 
              plain 
              @click="importMetadataFromSqlite"
              :disabled="importingMetadata"
              :loading="importingMetadata"
              style="flex: 1"
            >
              {{ importingMetadata ? $t('m.importing') || '导入中...' : $t('m.importMetadataFromSqlite') }}
            </el-button>
            <el-button 
              type="danger" 
              plain
              @click="stopImportMetadata"
              :disabled="!importingMetadata"
              v-if="importingMetadata"
            >
              {{ $t('m.stopImport') || '停止导入' }}
            </el-button>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- More Advanced Buttons -->
    <el-row :gutter="8">
      <el-col :span="8">
        <div class="setting-line advanced-button-group">
          <div class="button-row">
            <el-button class="function-button advanced-button" type="danger" :icon="Delete"
                       :loading="busyRemove" :disabled="busyRemove" @click="removeMissingRecords"
            >{{$t('m.removeMissingRecords')}}
            </el-button>
          </div>
          <div class="button-row">
            <el-button class="function-button advanced-button" type="warning" plain @click="fillNoCategoryMetadata">
              {{$t('m.fillNoCategoryMetadata')}}
            </el-button>
          </div>
        </div>
      </el-col>
      <el-col :span="8">
        <div class="setting-line advanced-button-group">
          <div class="button-row">
            <el-button class="function-button advanced-button" type="warning" plain @click="clearMatchBlacklist">
              清空匹配黑名单
            </el-button>
          </div>
          <div class="button-row">
            <el-button class="function-button advanced-button" type="info" plain @click="showBlacklistStats">
              查看黑名单
            </el-button>
          </div>
        </div>
      </el-col>
      <el-col :span="8">
        <div class="setting-line advanced-button-group">
          <div class="button-row">
            <el-button class="function-button advanced-button" type="success" plain @click="showTitleIndexCacheStatus">
              📦 标题索引缓存
            </el-button>
          </div>
          <div class="button-row">
            <el-button class="function-button advanced-button" type="warning" plain @click="clearTitleIndexCache">
              清除缓存
            </el-button>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- Final Row of Buttons -->
    <el-row :gutter="8">
      <el-col :span="8">
        <div class="setting-line advanced-button-group">
          <div class="button-row">
            <el-popconfirm
                placement="top-start"
                title="确定要清理所有文件夹类型的漫画吗？此操作不可撤销。"
                @confirm="cleanFolderManga"
            >
              <template #reference>
                <el-button class="function-button advanced-button" type="danger" plain>
                  清理文件夹漫画
                </el-button>
              </template>
            </el-popconfirm>
          </div>
          <div class="button-row">
            <el-popconfirm
                placement="top-start"
                title="确定要修复缺失的封面吗？这将检查所有书籍并重新生成缺失的封面缩略图。"
                @confirm="repairMissingCovers"
            >
              <template #reference>
                <el-button class="function-button advanced-button" type="primary" plain>
                  修复缺失封面
                </el-button>
              </template>
            </el-popconfirm>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- Switch Options -->
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
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Delete } from '@element-plus/icons-vue'
import { MdRefresh } from '@vicons/ionicons4'
import NameFormItem from '../NameFormItem.vue'

const { t } = useI18n()

const props = defineProps({
  setting: {
    type: Object,
    required: true
  },
  searchTypeList: {
    type: Array,
    default: () => []
  },
  bookList: {
    type: Array,
    default: () => []
  },
  busyRemove: {
    type: Boolean,
    default: false
  },
  importingMetadata: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'save-setting',
  'handle-language-change',
  'apply-exclude-rules',
  'reload-window',
  'force-gene-book-list',
  'patch-local-metadata',
  'export-database',
  'export-ai-matched-data',
  'import-database',
  'import-metadata-from-sqlite',
  'stop-import-metadata',
  'remove-missing-records',
  'fill-no-category-metadata',
  'clear-match-blacklist',
  'show-blacklist-stats',
  'show-title-index-cache-status',
  'clear-title-index-cache',
  'clean-folder-manga',
  'repair-missing-covers',
  'handle-translation-setting-change'
])

// concurrent scan options; default is min(concurrencyOptionCeiling, 4)
const concurrencyOptionCeiling = Math.max(1, Number(navigator.hardwareConcurrency) || 4)
const defaultConcurrentScan = Math.min(concurrencyOptionCeiling, 4)
const defaultConcurrentWrite = Math.min(concurrencyOptionCeiling, 2)

const normalizeConcurrency = (v, fallback) => {
  const n = Number(v)
  return Number.isFinite(n) && n >= 1 && n <= concurrencyOptionCeiling ? Math.trunc(n) : fallback
}

const advancedCollapse = ref([])

const saveSetting = () => emit('save-setting')
const handleLanguageChange = (val) => emit('handle-language-change', val)
const applyExcludeRules = () => emit('apply-exclude-rules')
const reloadWindow = () => emit('reload-window')
const forceGeneBookList = () => emit('force-gene-book-list')
const patchLocalMetadata = () => emit('patch-local-metadata')
const exportDatabase = () => emit('export-database')
const exportAiMatchedData = () => emit('export-ai-matched-data')
const importDatabase = () => emit('import-database')
const importMetadataFromSqlite = () => emit('import-metadata-from-sqlite')
const stopImportMetadata = () => emit('stop-import-metadata')
const removeMissingRecords = () => emit('remove-missing-records')
const fillNoCategoryMetadata = () => emit('fill-no-category-metadata')
const clearMatchBlacklist = () => emit('clear-match-blacklist')
const showBlacklistStats = () => emit('show-blacklist-stats')
const showTitleIndexCacheStatus = () => emit('show-title-index-cache-status')
const clearTitleIndexCache = () => emit('clear-title-index-cache')
const cleanFolderManga = () => emit('clean-folder-manga')
const repairMissingCovers = () => emit('repair-missing-covers')
const handleTranslationSettingChange = (val) => emit('handle-translation-setting-change', val)
</script>

<style lang="stylus">
.setting-line.regexp
  .el-input__inner
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace

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

.setting-line--concurrency .label-input {
  width: 100%;
}

/* Align the right gray divider with the row above */
.setting-line--concurrency .label-input .el-input-group__prepend {
  width: var(--setting-label-width);
  flex: 0 0 var(--setting-label-width);
  max-width: var(--setting-label-width);

  box-sizing: border-box; /* include border in width calc */
  padding: 0 29px; /* mirror your other row's padding */
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

/* Advanced tab button group styles */
.advanced-button-group {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 8px;
}

.button-row {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.advanced-button {
  width: 100%;
  height: 100%;
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.button-checkbox {
  width: 100%;
  text-align: center;
  margin: 0 !important;
}
</style>