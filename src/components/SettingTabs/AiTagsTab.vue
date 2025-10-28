<template>
  <el-row :gutter="8">
    <!-- AI API 配置 -->
    <el-col :span="24">
      <el-alert
          title="AI 自动标签推断"
          type="info"
          :closable="false"
          show-icon
          style="margin-bottom: 16px;"
      >
        <template #default>
          <p>通过 AI 根据书籍标题自动推断标签（原作、角色、画师、社团等）</p>
          <p>支持 OpenAI、DeepSeek、Qwen、Gemini 等兼容 API</p>
        </template>
      </el-alert>
    </el-col>

    <!-- API 配置文件 -->
    <el-col :span="24">
      <div class="setting-line">
        <el-input
            v-model="aiApiConfigPath"
            readonly
            placeholder="使用翻译 API 配置"
        >
          <template #prepend><span class="setting-label">API 配置</span></template>
          <template #append>
            <el-button @click="openAiApiConfigFile">编辑配置</el-button>
          </template>
        </el-input>
      </div>
    </el-col>

    <!-- 显示当前配置 -->
    <el-col :span="24" v-if="activeProvider">
      <el-descriptions :column="2" border size="small" style="margin: 16px 0;">
        <el-descriptions-item label="提供商">{{ activeProvider.name }}</el-descriptions-item>
        <el-descriptions-item label="API URL">{{ activeProvider.baseUrl }}</el-descriptions-item>
        <el-descriptions-item label="模型">{{ activeProvider.model }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag type="success">已启用</el-tag>
        </el-descriptions-item>
      </el-descriptions>
    </el-col>

    <!-- 测试 API -->
    <el-col :span="12">
      <div class="setting-line">
        <el-button
            type="primary"
            @click="testAiApiConnection"
            :loading="testingAiApi"
            :disabled="!activeProvider"
            style="width: 100%"
        >
          {{ testingAiApi ? '测试中...' : '测试 API 连接' }}
        </el-button>
      </div>
    </el-col>

    <!-- 查看标签统计 -->
    <el-col :span="12">
      <div class="setting-line">
        <el-button
            @click="showTagStatistics"
            style="width: 100%"
        >
          查看标签统计
        </el-button>
      </div>
    </el-col>

    <!-- 批量推断设置 -->
    <el-col :span="12">
      <div class="setting-line">
        <el-tooltip
            content="单次API请求中包含的书籍数量。较大的值可以提高速度但可能超出API限制，建议值：5-20"
            placement="top"
        >
          <el-input-number
              v-model="setting.aiTagBatchSize"
              :min="1"
              :max="50"
              :step="1"
              @change="saveSetting"
              style="width: 100%"
          >
            <template #prepend>
              <span class="setting-label">批量推断数量</span>
            </template>
          </el-input-number>
        </el-tooltip>
      </div>
    </el-col>

    <!-- 推断间隔 -->
    <el-col :span="12">
      <div class="setting-line">
        <el-tooltip
            content="处理完一个批次后，等待多长时间再处理下一个批次，以避免API限流。单位是毫秒（1000ms = 1秒）。"
            placement="top"
        >
          <el-input-number
              v-model="setting.aiTagDelay"
              :min="500"
              :max="10000"
              :step="100"
              @change="saveSetting"
              style="width: 100%"
          >
            <template #prepend>
              <span class="setting-label">批次间隔(ms)</span>
            </template>
          </el-input-number>
        </el-tooltip>
      </div>
    </el-col>

    <!-- 保留未知标签 -->
    <el-col :span="24" class="setting-switch">
      <el-switch
          v-model="setting.aiKeepUnknownTags"
          active-text="保留未匹配到的新标签"
          @change="saveSetting"
      />
    </el-col>

    <!-- 批量推断按钮 -->
    <el-col :span="12">
      <div class="setting-line">
        <el-button
            type="success"
            @click="batchInferTags"
            :loading="batchInferring"
            :disabled="!activeProvider"
            style="width: 100%"
        >
          {{ batchInferring ? `推断中 ${aiInferProgress.current}/${aiInferProgress.total}` : '批量推断标签' }}
        </el-button>
      </div>
    </el-col>

    <!-- 停止推断 -->
    <el-col :span="12">
      <div class="setting-line">
        <el-button
            type="danger"
            @click="stopBatchInfer"
            :disabled="!batchInferring"
            style="width: 100%"
        >
          停止推断
        </el-button>
      </div>
    </el-col>

    <!-- 进度显示 -->
    <el-col :span="24" v-if="batchInferring">
      <el-progress
          :percentage="aiInferProgress.total > 0 ? Math.round((aiInferProgress.current / aiInferProgress.total) * 100) : 0"
          :status="aiInferProgress.current === aiInferProgress.total ? 'success' : undefined"
      >
        <span>{{ aiInferProgress.current }} / {{ aiInferProgress.total }}</span>
      </el-progress>
    </el-col>

    <!-- 帮助信息 -->
    <el-col :span="24">
      <el-alert type="success" :closable="false" show-icon style="margin-top: 16px;">
        <template #default>
          <p><b>提示：</b>批量推断将以主界面的<b>当前排序顺序</b>，处理<b>当前显示</b>的书籍（会尊重文件夹筛选）。</p>
        </template>
      </el-alert>
    </el-col>
    <el-col :span="24">
      <el-alert
          title="使用说明"
          type="warning"
          :closable="false"
          show-icon
          style="margin-top: 16px;"
      >
        <template #default>
          <p><strong>配置步骤：</strong></p>
          <ol>
            <li>先在「翻译」tab 中配置 API（添加提供商、填写 API Key）</li>
            <li>切换到「AI 标签」tab，系统会自动使用翻译的 API 配置</li>
            <li>点击"测试 API 连接"验证配置</li>
            <li>设置批量数量和间隔，开始推断</li>
          </ol>
          <p><strong>注意事项：</strong></p>
          <ul>
            <li>使用翻译 tab 中的 API 配置，无需重复配置</li>
            <li>只推断状态为 "non-tag" 或 "tag-failed" 的书籍</li>
            <li>AI 会参考数据库中已有的常用标签</li>
            <li>批量推断会自动限流，避免 API 限制</li>
            <li>推断结果建议人工复核</li>
            <li>成本估算：GPT-3.5 约 $0.003/本，DeepSeek 约 ¥0.001/本</li>
          </ul>
        </template>
      </el-alert>
    </el-col>
  </el-row>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const props = defineProps({
  setting: {
    type: Object,
    required: true
  },
  displayBookList: {
    type: Array,
    default: () => []
  },
  activeProvider: {
    type: Object,
    default: null
  }
})

const emit = defineEmits([
  'save-setting',
  'open-ai-api-config-file',
  'test-ai-api-connection',
  'show-tag-statistics',
  'batch-infer-tags',
  'stop-batch-infer'
])

// AI Tag inference state
const testingAiApi = ref(false)
const batchInferring = ref(false)
const aiInferProgress = ref({ current: 0, total: 0 })
const aiApiConfigPath = ref('config/ai_api_config.json')

const saveSetting = () => emit('save-setting')
const openAiApiConfigFile = () => emit('open-ai-api-config-file')
const testAiApiConnection = () => emit('test-ai-api-connection')
const showTagStatistics = () => emit('show-tag-statistics')
const batchInferTags = () => emit('batch-infer-tags')
const stopBatchInfer = () => emit('stop-batch-infer')

// Expose methods for parent component to update state
defineExpose({
  testingAiApi,
  batchInferring,
  aiInferProgress,
  aiApiConfigPath
})
</script>

<style lang="stylus">
.setting-switch
  text-align: left
  margin-top: 6px
</style>