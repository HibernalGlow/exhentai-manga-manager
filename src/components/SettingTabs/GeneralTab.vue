<template>
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
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  setting: {
    type: Object,
    required: true
  },
  libs: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits([
  'save-setting',
  'select-metadata-path',
  'select-default-sql-path',
  'select-blacklist-path',
  'select-image-explorer-path',
  'test-proxy',
  'handle-theme-change',
  'open-libraries-tab'
])

const libHead = computed(() => props.libs.slice(0, 2)) // only show the first two
const libMoreCount = computed(() => Math.max(0, props.libs.length - libHead.value.length))

const saveSetting = () => emit('save-setting')
const selectMetadataPath = () => emit('select-metadata-path')
const selectDefaultSqlPath = () => emit('select-default-sql-path')
const selectBlacklistPath = () => emit('select-blacklist-path')
const selectImageExplorerPath = () => emit('select-image-explorer-path')
const testProxy = () => emit('test-proxy')
const handleThemeChange = (val) => emit('handle-theme-change', val)
const openLibrariesTab = () => emit('open-libraries-tab')
</script>

<style lang="stylus">
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
</style>