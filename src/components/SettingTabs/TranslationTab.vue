<template>
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
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h3>{{ $t('m.aiApiConfig') }}</h3>
        <el-button size="small" @click="loadApiConfig">
          <el-icon><MdRefresh /></el-icon>
          {{ $t('m.refreshConfig') || '刷新配置' }}
        </el-button>
      </div>
    </el-col>

    <!-- Provider 列表 -->
    <el-col :span="24" v-if="apiConfig && apiConfig.providers">
      <div class="setting-line">
        <el-radio-group 
          v-model="activeProviderIndex" 
          @change="switchActiveProvider"
          style="width: 100%"
        >
          <el-radio 
            v-for="(provider, index) in apiConfig.providers" 
            :key="index" 
            :label="index"
            :disabled="!provider.enabled"
            style="width: 100%; margin: 8px 0; display: flex; align-items: center;"
          >
            <div style="flex: 1; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong>{{ provider.name }}</strong>
                <el-tag size="small" style="margin-left: 8px" v-if="index === activeProviderIndex">当前使用</el-tag>
                <el-tag size="small" type="info" style="margin-left: 8px" v-if="!provider.enabled">已禁用</el-tag>
              </div>
              <div style="font-size: 12px; color: var(--el-text-color-secondary);">
                {{ provider.model }}
              </div>
            </div>
          </el-radio>
        </el-radio-group>
      </div>
    </el-col>

    <!-- 当前活动 Provider 详情 -->
    <el-col :span="24" v-if="activeProvider">
      <el-descriptions :column="1" border size="small" style="margin-top: 10px;">
        <el-descriptions-item label="提供商">{{ activeProvider.name }}</el-descriptions-item>
        <el-descriptions-item label="类型">{{ activeProvider.provider }}</el-descriptions-item>
        <el-descriptions-item label="模型">{{ activeProvider.model }}</el-descriptions-item>
        <el-descriptions-item label="Base URL">{{ activeProvider.baseUrl }}</el-descriptions-item>
        <el-descriptions-item label="Temperature">{{ activeProvider.temperature }}</el-descriptions-item>
        <el-descriptions-item label="Max Tokens">{{ activeProvider.maxTokens }}</el-descriptions-item>
      </el-descriptions>
    </el-col>

    <!-- Batch Translation Size -->
    <el-col :span="12">
      <div class="setting-line">
        <el-input-number
            v-model="setting.batchTranslationSize"
            :min="1"
            :max="100"
            :step="1"
            @change="saveSetting"
            style="width: 100%"
        >
          <template #prepend>
            <span class="setting-label">{{ $t('m.batchTranslationSize') || '每批翻译数量' }}</span>
          </template>
        </el-input-number>
      </div>
    </el-col>

    <!-- API Timeout -->
    <el-col :span="12">
      <div class="setting-line">
        <el-input-number
            v-model="setting.aiTimeout"
            :min="10"
            :max="300"
            :step="5"
            @change="saveSetting"
            style="width: 100%"
        >
          <template #prepend>
            <span class="setting-label">{{ $t('m.apiTimeout') || 'API超时(秒)' }}</span>
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
    <el-col :span="12">
      <div class="setting-line">
        <el-button
            type="success"
            @click="batchTranslate"
            :loading="batchTranslating"
            :disabled="batchTranslating"
            style="width: 100%"
        >
          {{ $t('m.batchTranslateAll') }}
        </el-button>
      </div>
    </el-col>
    
    <!-- 停止翻译 -->
    <el-col :span="12">
      <div class="setting-line">
        <el-button
            type="danger"
            @click="stopBatchTranslation"
            :disabled="!batchTranslating"
            style="width: 100%"
        >
          {{ $t('m.stopBatchTranslate') || '停止翻译' }}
        </el-button>
      </div>
    </el-col>
    
    <!-- 翻译进度 -->
    <el-col :span="24" v-if="batchTranslating">
      <el-progress 
        :percentage="batchProgress.total > 0 ? Math.round((batchProgress.current / batchProgress.total) * 100) : 0" 
        :text-inside="true"
        :stroke-width="20"
        status="success"
      >
        <template #default="{ percentage }">
          {{ batchProgress.current }} / {{ batchProgress.total }} ({{ percentage }}%)
        </template>
      </el-progress>
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
</template>

<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { MdRefresh } from '@vicons/ionicons4'

const { t } = useI18n()

const props = defineProps({
  setting: {
    type: Object,
    required: true
  },
  bookList: {
    type: Array,
    default: () => []
  },
  resolvedTranslation: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits([
  'save-setting',
  'load-api-config',
  'switch-active-provider',
  'test-api-connection',
  'open-api-config-file',
  'batch-translate',
  'stop-batch-translation'
])

// Translation API testing state
const testingApi = ref(false)
const batchTranslating = ref(false)
const batchProgress = ref({ current: 0, total: 0 })

// API Config from JSON
const apiConfig = ref(null)
const activeProviderIndex = ref(0)

// Get current active provider
const activeProvider = computed(() => {
  if (!apiConfig.value || !apiConfig.value.providers) return null
  return apiConfig.value.providers[activeProviderIndex.value]
})

const saveSetting = () => emit('save-setting')
const loadApiConfig = () => emit('load-api-config')
const switchActiveProvider = (index) => emit('switch-active-provider', index)
const testApiConnection = () => emit('test-api-connection')
const openApiConfigFile = () => emit('open-api-config-file')
const batchTranslate = () => emit('batch-translate')
const stopBatchTranslation = () => emit('stop-batch-translation')

// Expose methods for parent component to update state
defineExpose({
  testingApi,
  batchTranslating,
  batchProgress,
  apiConfig,
  activeProviderIndex
})
</script>