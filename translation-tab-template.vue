<!-- Translation Tab for Setting.vue -->
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
              </template>
            </el-alert>
          </el-col>
        </el-row>
      </el-tab-pane>
