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
        <GeneralTab
          :setting="setting"
          :libs="libs"
          @save-setting="saveSetting"
          @select-metadata-path="selectMetadataPath"
          @select-default-sql-path="selectDefaultSqlPath"
          @select-blacklist-path="selectBlacklistPath"
          @select-image-explorer-path="selectImageExplorerPath"
          @test-proxy="testProxy"
          @handle-theme-change="handleThemeChange"
          @open-libraries-tab="openLibrariesTab"
        />
      </el-tab-pane>
      <el-tab-pane :label="$t('m.manageLibrary')" name="libraries">
        <LibrariesTab
          ref="librariesTabRef"
          :setting="setting"
          @save-setting="saveSetting"
          @add-libraries="addLibraries"
          @save-libraries="saveLibraries"
          @open-in-os="openInOS"
        />
      </el-tab-pane>
      <el-tab-pane :label="$t('m.internalViewer')" name="internalViewer">
        <InternalViewerTab
          :setting="setting"
          @save-setting="saveSetting"
        />
      </el-tab-pane>
      <el-tab-pane :label="$t('m.collectTag')" name="collectTag">
        <CollectTagTab
          :setting="setting"
          :tag-list-raw="tagListRaw"
          :resolved-translation="resolvedTranslation"
          @save-setting="saveSetting"
        />
      </el-tab-pane>
      <el-tab-pane :label="$t('m.advanced')" name="advanced">
        <AdvancedTab
          :setting="setting"
          :search-type-list="searchTypeList"
          :book-list="bookList"
          :busy-remove="busyRemove"
          :importing-metadata="importingMetadata"
          @save-setting="saveSetting"
          @handle-language-change="handleLanguageChange"
          @apply-exclude-rules="applyExcludeRules"
          @reload-window="reloadWindow"
          @force-gene-book-list="forceGeneBookList"
          @patch-local-metadata="patchLocalMetadata"
          @export-database="exportDatabase"
          @export-ai-matched-data="exportAiMatchedData"
          @import-database="importDatabase"
          @import-metadata-from-sqlite="importMetadataFromSqlite"
          @stop-import-metadata="stopImportMetadata"
          @remove-missing-records="removeMissingRecords"
          @fill-no-category-metadata="fillNoCategoryMetadata"
          @clear-match-blacklist="clearMatchBlacklist"
          @show-blacklist-stats="showBlacklistStats"
          @show-title-index-cache-status="showTitleIndexCacheStatus"
          @clear-title-index-cache="clearTitleIndexCache"
          @clean-folder-manga="cleanFolderManga"
          @repair-missing-covers="repairMissingCovers"
          @handle-translation-setting-change="handleTranslationSettingChange"
        />
      </el-tab-pane>
      <el-tab-pane :label="$t('m.translation')" name="translation">
        <TranslationTab
          ref="translationTabRef"
          :setting="setting"
          :book-list="bookList"
          :resolved-translation="resolvedTranslation"
          @save-setting="saveSetting"
          @load-api-config="loadApiConfig"
          @switch-active-provider="switchActiveProvider"
          @test-api-connection="testApiConnection"
          @open-api-config-file="openApiConfigFile"
          @batch-translate="batchTranslate"
          @stop-batch-translation="stopBatchTranslation"
        />
      </el-tab-pane>
      <el-tab-pane label="AI 标签" name="ai-tags">
        <AiTagsTab
          ref="aiTagsTabRef"
          :setting="setting"
          :display-book-list="displayBookList"
          :active-provider="activeProvider"
          @save-setting="saveSetting"
          @open-ai-api-config-file="openAiApiConfigFile"
          @test-ai-api-connection="testAiApiConnection"
          @show-tag-statistics="showTagStatistics"
          @batch-infer-tags="batchInferTags"
          @stop-batch-infer="stopBatchInfer"
        />
      </el-tab-pane>
      <el-tab-pane :label="$t('m.accelerator')" name="accelerator">
        <AcceleratorTab
          :accelerator-info="acceleratorInfo"
        />
      </el-tab-pane>
      <el-tab-pane :label="$t('m.about')" name="about">
        <AboutTab
          :version="version"
          @open-link="openLink"
          @auto-check-updates="autoCheckUpdates"
        />
      </el-tab-pane>
    </el-tabs>
  </el-dialog>
</template>

<script setup>
import { ref, onMounted, h, computed, watch, watchEffect, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'

import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import zhTw from 'element-plus/dist/locale/zh-tw.mjs'
import en from 'element-plus/dist/locale/en.mjs'

import { version } from '../../package.json'
import { gh_token } from '../../secret_key.json'
import { acceleratorInfo } from '../utils.js'

import { storeToRefs } from 'pinia'
import { useAppStore } from '../pinia.js'

// Import tab components
import GeneralTab from './SettingTabs/GeneralTab.vue'
import LibrariesTab from './SettingTabs/LibrariesTab.vue'
import InternalViewerTab from './SettingTabs/InternalViewerTab.vue'
import CollectTagTab from './SettingTabs/CollectTagTab.vue'
import AdvancedTab from './SettingTabs/AdvancedTab.vue'
import TranslationTab from './SettingTabs/TranslationTab.vue'
import AiTagsTab from './SettingTabs/AiTagsTab.vue'
import AcceleratorTab from './SettingTabs/AcceleratorTab.vue'
import AboutTab from './SettingTabs/AboutTab.vue'

const appStore = useAppStore()
const { searchTypeList, setting, bookList, displayBookList, resolvedTranslation, localeFile, tagListRaw } = storeToRefs(appStore)
const { printMessage } = appStore

const { t, locale } = useI18n()
const dialogVisibleSetting = ref(false)
const activeSettingPanel = ref('general')

// References to tab components
const librariesTabRef = ref(null)
const translationTabRef = ref(null)
const aiTagsTabRef = ref(null)

const emit = defineEmits([
  'loadBookList',
  'loadCollectionList',
])

// Import metadata state
const importingMetadata = ref(false)

// API Config from JSON
const apiConfig = ref(null)
const activeProviderIndex = ref(0)

// Get current active provider
const activeProvider = computed(() => {
  if (!apiConfig.value || !apiConfig.value.providers) return null
  return apiConfig.value.providers[activeProviderIndex.value]
})

// concurrent scan options; default is min(concurrencyOptionCeiling, 4)
const concurrencyOptionCeiling = Math.max(1, Number(navigator.hardwareConcurrency) || 4)
const defaultConcurrentScan = Math.min(concurrencyOptionCeiling, 4)
const defaultConcurrentWrite = Math.min(concurrencyOptionCeiling, 2)

const normalizeConcurrency = (v, fallback) => {
  const n = Number(v)
  return Number.isFinite(n) && n >= 1 && n <= concurrencyOptionCeiling ? Math.trunc(n) : fallback
}

// Load API config from JSON
const loadApiConfig = async () => {
  try {
    const config = await ipcRenderer.invoke('get-api-config')
    if (config) {
      console.log('[Setting.vue] Loaded API config from backend:', config);
      apiConfig.value = config
      activeProviderIndex.value = config.activeIndex || 0
      console.log('[Setting.vue] Set activeProviderIndex to:', activeProviderIndex.value);
    }
  } catch (e) {
    console.error('Failed to load API config:', e)
  }
}

// Switch active provider
const switchActiveProvider = async (index) => {
  try {
    if (!apiConfig.value) return
    
    apiConfig.value.activeIndex = index
    activeProviderIndex.value = index
    
    // Save to JSON file - convert reactive object to plain object
    await ipcRenderer.invoke('save-api-config', JSON.parse(JSON.stringify(apiConfig.value)))
    
    ElMessage.success(t('m.apiProviderSwitched') || '已切换API提供商')
  } catch (e) {
    ElMessage.error('切换失败: ' + e.message)
  }
}

// Stop batch translation
const stopBatchTranslation = async () => {
  try {
    if (translationTabRef.value) {
      translationTabRef.value.batchTranslating = false
    }
    await ipcRenderer.invoke('stop-batch-translation')
    ElMessage.warning(t('m.batchTranslateStopped') || '批量翻译已停止')
  } catch (e) {
    console.error('Stop translation error:', e)
  }
}

// ========== AI Tag Inference Functions ==========

// Load AI API config
const loadAiApiConfig = async () => {
  try {
    // 直接使用翻译的配置，不需要单独的 AI 配置
    if (activeProvider.value) {
      // AI tags tab will use the same config as translation
    }
  } catch (e) {
    console.error('Load AI API config error:', e)
  }
}

// Open AI API config file
const openAiApiConfigFile = async () => {
  try {
    // 直接使用翻译的配置打开功能
    const result = await ipcRenderer.invoke('open-api-config-file')
    if (result.success) {
      ElMessage.success('API配置文件已打开，编辑后请刷新配置')
      // 延迟重新加载配置
      setTimeout(() => {
        loadApiConfig()
        loadAiApiConfig()
      }, 1000)
    } else {
      ElMessage.error('打开配置文件失败: ' + result.error)
    }
  } catch (e) {
    console.error('Open AI API config error:', e)
    ElMessage.error('打开配置文件失败: ' + e.message)
  }
}

// Test AI API connection
const testAiApiConnection = async () => {
  try {
    if (aiTagsTabRef.value) {
      aiTagsTabRef.value.testingAiApi = true
    }
    
    // 重新加载配置
    await loadApiConfig()
    await loadAiApiConfig()
    
    if (!activeProvider.value) {
      ElMessage.warning('请先在翻译 tab 中配置 API')
      return
    }
    
    // 测试标题
    const testTitle = '(C96) [サークル名 (作者名)] テスト本 (オリジナル)'
    
    const result = await ipcRenderer.invoke('ai-infer-tags', {
      bookId: 'test',
      title: testTitle,
      apiConfig: {
        enabled: true,
        apiUrl: activeProvider.value.baseUrl,
        apiKey: activeProvider.value.apiKey,
        model: activeProvider.value.model,
        maxTokens: activeProvider.value.maxTokens || 500,
        temperature: activeProvider.value.temperature || 0.3,
        minTagCount: 3,
        keepUnknownTags: setting.value.aiKeepUnknownTags
      }
    })
    
    if (result.success) {
      ElMessage.success('API 测试成功！推断标签: ' + JSON.stringify(result.tags))
    } else {
      ElMessage.error('API 测试失败: ' + result.message)
    }
  } catch (e) {
    console.error('Test AI API error:', e)
    ElMessage.error('测试失败: ' + e.message)
  } finally {
    if (aiTagsTabRef.value) {
      aiTagsTabRef.value.testingAiApi = false
    }
  }
}

// Show tag statistics
const showTagStatistics = async () => {
  try {
    const result = await ipcRenderer.invoke('get-existing-tags')
    
    if (result.success) {
      let message = '数据库标签统计：\n\n'
      for (const [category, count] of Object.entries(result.counts)) {
        message += `${category}: ${count} 个\n`
      }
      
      ElMessageBox.alert(message, '标签统计', {
        confirmButtonText: '确定',
        type: 'info'
      })
    } else {
      ElMessage.error('获取标签统计失败: ' + result.message)
    }
  } catch (e) {
    console.error('Show tag statistics error:', e)
    ElMessage.error('获取标签统计失败: ' + e.message)
  }
}

// Batch infer tags
const batchInferTags = async () => {
  try {
    if (aiTagsTabRef.value) {
      aiTagsTabRef.value.batchInferring = true;
      aiTagsTabRef.value.aiInferProgress = { current: 0, total: 0 };
    }

    await loadApiConfig();
    await loadAiApiConfig();

    if (!activeProvider.value) {
      ElMessage.warning('请先在翻译 tab 中配置 API');
      if (aiTagsTabRef.value) {
        aiTagsTabRef.value.batchInferring = false;
      }
      return;
    }

    const booksToInfer = displayBookList.value.filter(book => 
      !book.isCollection && (book.status === 'non-tag' || book.status === 'tag-failed')
    );

    if (booksToInfer.length === 0) {
      ElMessage.info('没有需要推断标签的书籍');
      if (aiTagsTabRef.value) {
        aiTagsTabRef.value.batchInferring = false;
      }
      return;
    }

    const bookIds = booksToInfer.map(b => b.id);
    if (aiTagsTabRef.value) {
      aiTagsTabRef.value.aiInferProgress.total = bookIds.length;
    }

    ElMessage.info(`开始为 ${bookIds.length} 本书籍批量推断标签...`);

    const progressHandler = (event, progress) => {
      if (aiTagsTabRef.value) {
        aiTagsTabRef.value.aiInferProgress = progress;
      }
    };
    ipcRenderer.on('ai-batch-progress', progressHandler);

    const result = await ipcRenderer.invoke('ai-batch-infer-tags', {
      bookIds: bookIds,
      apiConfig: {
        enabled: true,
        apiUrl: activeProvider.value.baseUrl,
        apiKey: activeProvider.value.apiKey,
        model: activeProvider.value.model,
        maxTokens: activeProvider.value.maxTokens || 500,
        temperature: activeProvider.value.temperature || 0.3,
        minTagCount: 3,
        keepUnknownTags: setting.value.aiKeepUnknownTags
      }
    });

    ipcRenderer.removeListener('ai-batch-progress', progressHandler);

    if (result.success) {
      ElMessage.success(`批量推断完成！成功: ${result.successCount}, 失败: ${result.errorCount}`);

      // Manually update the store to ensure reactivity
      console.log(`🔄 正在更新 ${result.results.length} 本书的前台数据...`);
      for (const updatedBook of result.results) {
        const bookIndex = bookList.value.findIndex(b => b.id === updatedBook.id);
        if (bookIndex !== -1) {
          bookList.value[bookIndex] = updatedBook;
        }
        // Also update bookDetail if it's the same book
        if (bookDetail.value && bookDetail.value.id === updatedBook.id) {
          bookDetail.value = updatedBook;
        }
      }

    } else {
      ElMessage.error('批量推断失败: ' + result.message);
    }

    if (result.errors && result.errors.length > 0) {
      console.error('批量推断中的错误:', result.errors);
    }

  } catch (e) {
    console.error('Batch infer tags error:', e);
    ElMessage.error('批量推断失败: ' + e.message);
  } finally {
    if (aiTagsTabRef.value) {
      aiTagsTabRef.value.batchInferring = false;
    }
  }
};

// Stop batch infer
const stopBatchInfer = () => {
  if (aiTagsTabRef.value) {
    aiTagsTabRef.value.batchInferring = false
  }
  ipcRenderer.invoke('stop-ai-batch-infer');
  ElMessage.warning('已发送停止推断信号')
}

const exportAiMatchedData = async () => {
  try {
    // 检查是否有AI匹配的书籍 - 匹配tags.other中的ai-matched
    const aiMatchedBooks = bookList.value.filter(book => {
      return book.tags && 
             book.tags.other && 
             Array.isArray(book.tags.other) && 
             book.tags.other.includes('ai-matched');
    });
    
    if (aiMatchedBooks.length === 0) {
      ElMessage.warning('没有找到AI匹配的书籍数据');
      return;
    }

    // 显示确认对话框
    await ElMessageBox.confirm(
      `找到 ${aiMatchedBooks.length} 本AI匹配的书籍，是否导出？`,
      '确认导出',
      {
        confirmButtonText: '导出',
        cancelButtonText: '取消',
        type: 'info'
      }
    );

    // 选择保存位置
    const folderPath = await ipcRenderer.invoke('select-folder', '选择要保存导出文件的文件夹');
    if (!folderPath) {
      ElMessage.info('已取消导出');
      return;
    }

    // 显示加载状态
    const loadingMessage = ElMessage({
      message: '正在导出AI匹配数据，请稍候...',
      type: 'info',
      duration: 0,
      showClose: false
    });

    try {
      // 执行导出
      const result = await ipcRenderer.invoke('export-ai-matched-books', folderPath);

      if (result.success) {
        ElMessage.success({
          message: `成功导出 ${result.count} 条数据到 ${result.filePath}`,
          duration: 5000,
          showClose: true
        });
        ipcRenderer.invoke('show-file', result.filePath);
      } else {
        ElMessage.error(`导出失败: ${result.error}`);
      }
    } finally {
      loadingMessage.close();
    }
  } catch (e) {
    if (e === 'cancel') {
      ElMessage.info('已取消导出');
    } else {
      console.error('Export AI matched data error:', e);
      ElMessage.error(`导出时发生错误: ${e.message || e}`);
    }
  }
}

// ========== End AI Tag Inference Functions ==========

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
    if (translationTabRef.value) {
      translationTabRef.value.testingApi = true
    }
    const result = await ipcRenderer.invoke('test-translation-api')
    if (result.success) {
      ElMessage.success(t('m.apiTestSuccess') || 'API test successful')
    } else {
      ElMessage.error((t('m.apiTestFailed') || 'API test failed') + ': ' + result.message)
    }
  } catch (e) {
    ElMessage.error((t('m.apiTestFailed') || 'API test failed') + ': ' + e.message)
  } finally {
    if (translationTabRef.value) {
      translationTabRef.value.testingApi = false
    }
  }
}

// Batch translate all books without translation
const batchTranslate = async () => {
  try {
    if (translationTabRef.value) {
      translationTabRef.value.batchTranslating = true
      translationTabRef.value.batchProgress = { current: 0, total: 0 }
    }
    
    console.log('[Translation] Starting batch translation...')
    
    // Get all books that need translation
    const booksToTranslate = bookList.value.filter(book => {
      // Check if already has translation
      const hasTranslation = resolvedTranslation.value[book.hash]
      return !hasTranslation
    })
    
    console.log(`[Translation] Found ${booksToTranslate.length} books without translation`)
    
    if (booksToTranslate.length === 0) {
      ElMessage.info(t('m.noBookNeedsTranslation') || '所有书籍都已翻译完成！')
      if (translationTabRef.value) {
        translationTabRef.value.batchTranslating = false
      }
      return
    }
    
    ElMessage.info(`准备翻译 ${booksToTranslate.length} 本书籍...`)
    
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
    
    // Extract only necessary settings (non-AI related) to avoid using old AI configs
    const simplifiedSettings = {
      excludePureNumberChinese: setting.value.excludePureNumberChinese,
      trimTitleRegExp: setting.value.trimTitleRegExp,  // 添加标题裁剪正则表达式
      batchTranslationSize: setting.value.batchTranslationSize || 10
    }
    
    console.log('[Translation] Simplified settings:', simplifiedSettings)
    
    // Listen for progress updates
    const progressHandler = (event, progress) => {
      console.log(`[Translation Progress] ${progress.current}/${progress.total} - ${progress.book.filename}`)
      if (translationTabRef.value) {
        translationTabRef.value.batchProgress = progress
      }
      
      // 根据状态显示不同的消息
      if (progress.status === 'success' && progress.translation) {
        ElMessage.success({
          message: `✅ [${progress.current}/${progress.total}] ${progress.translation.chinese_title}`,
          duration: 2000,
          showClose: true
        })
        console.log(`[Translation] ✅ ${progress.book.filename} -> ${progress.translation.chinese_title}`)
        
        // 实时更新书籍列表（触发重新加载）
        emit('loadBookList')
      } else if (progress.status === 'failed') {
        ElMessage.warning({
          message: `⚠️ [${progress.current}/${progress.total}] ${progress.book.filename} - 翻译失败`,
          duration: 2000,
          showClose: true
        })
      } else {
        // 普通进度更新
        ElMessage.info({
          message: `🔄 [${progress.current}/${progress.total}] ${progress.book.filename}`,
          duration: 1000,
          showClose: true
        })
      }
    }
    ipcRenderer.on('batch-translate-progress', progressHandler)
    
    ElMessage.info(`开始翻译 ${booksToTranslate.length} 本书籍...`)
    
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
    
    // 显示详细的翻译结果
    const totalBooks = bookList.value.length
    const translatedBooks = booksToTranslate.length
    const message = `翻译完成！\n` +
      `📊 统计信息：\n` +
      `• 总书籍数：${totalBooks}\n` +
      `• 本次处理：${translatedBooks}\n` +
      `• ✅ 成功：${result.success}\n` +
      `• ❌ 失败：${result.failed}\n` +
      `• ⏭️ 跳过：${result.skipped}`
    
    ElMessage({
      message: message,
      type: 'success',
      duration: 5000,
      showClose: true
    })
    
    // Reload book list to show new translations
    console.log('[Translation] Reloading book list...')
    emit('loadBookList')
  } catch (e) {
    console.error('[Translation] Batch translation error:', e)
    ElMessage.error((t('m.batchTranslateFailed') || 'Batch translation failed') + ': ' + e.message)
  } finally {
    if (translationTabRef.value) {
      translationTabRef.value.batchTranslating = false
      translationTabRef.value.batchProgress = { current: 0, total: 0 }
    }
  }
}

onMounted(() => {
  // Load API config from JSON
  loadApiConfig()
  // Load AI API config
  loadAiApiConfig()
  
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
    if (res.aiApiKey === undefined) setting.value.aiApiKey = ''
    if (res.aiModel === undefined) setting.value.aiModel = 'deepseek/deepseek-chat-v3.1:free'
    if (res.aiTemperature === undefined) setting.value.aiTemperature = 0.3
    if (res.aiMaxTokens === undefined) setting.value.aiMaxTokens = 100
    if (res.aiTimeout === undefined) setting.value.aiTimeout = 30  // 默认30秒超时
    if (res.batchTranslationSize === undefined) setting.value.batchTranslationSize = 10
    if (res.aiKeepUnknownTags === undefined) setting.value.aiKeepUnknownTags = true
    setting.value.concurrentScan = normalizeConcurrency(res.concurrentScan, defaultConcurrentScan)
    setting.value.concurrentWrite = normalizeConcurrency(res.concurrentWrite, defaultConcurrentWrite)
    
    // Matching defaults
    if (res.matchSha1 === undefined) setting.value.matchSha1 = true
    if (res.fastMatch === undefined) setting.value.fastMatch = true
    
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

    if (librariesTabRef.value) {
      const list = librariesTabRef.value.workingLibraries || []
      const i = list.findIndex(x => x?.path === path)

      if (i >= 0) {
        // already there: mark as exists (useful if it was missing before)
        list[i] = { ...list[i], exists: true }
      } else {
        list.push({ path: path, exists: true })
      }
      librariesTabRef.value.workingLibraries = [...list]
    }

  } catch (e) {
    ElMessage.error(e?.message || 'Failed to add folders')
  }
}

async function openInOS(path) {
  if (path) {
    await ipcRenderer.invoke('show-folder', path)
  }
}

function saveLibraries(workingLibraries) {
  const paths = (workingLibraries || []).map(x => x.path)
  setting.value.libraries = Array.from(new Set(paths))
  saveSetting()
  ElMessage.success(t('m.saved') || 'Saved')
  dialogVisibleSetting.value = false
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

const selectBlacklistPath = async () => {
  const folder = await ipcRenderer.invoke('select-folder', '选择黑名单存储文件夹')
  if (folder) {
    setting.value.blacklistPath = folder
    await saveSetting()
  }
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
  try {
    importingMetadata.value = true
    const matchOptions = {
      matchTitleOnly: setting.value.matchTitleOnly,
      matchHash: setting.value.matchHash,
      matchSha1: setting.value.matchSha1,
      fastMatch: setting.value.fastMatch,
      trimTitleRegExp: setting.value.trimTitleRegExp  // 传递裁剪标题正则表达式
    }
    // 只传递未标记的书籍，避免不必要的遍历
    const untaggedBooks = bookList.value.filter(book => book.status !== 'tagged')
    const { success, matched, blacklisted, processed, skipped } = await ipcRenderer.invoke('import-sqlite', {
      bookList: _.cloneDeep(untaggedBooks),
      matchOptions,
      defaultSqlPath: setting.value.defaultSqlPath  // 传递默认SQL路径
    })
    if (success) {
      const skipMsg = skipped > 0 ? `, 跳过已标记:${skipped}` : ''
      printMessage('success', t('c.importMessage') + ` (匹配:${matched}, 新增黑名单:${blacklisted}, 处理:${processed}${skipMsg})`)
      emit('loadBookList')
    } else {
      printMessage('info', t('c.canceled'))
    }
  } catch (e) {
    console.error('[Import] Error:', e)
    if (e.message && e.message.includes('aborted')) {
      printMessage('warning', t('m.importStopped') || '导入已停止')
    } else {
      printMessage('error', t('c.importFailed') || '导入失败')
    }
  } finally {
    importingMetadata.value = false
  }
}

const stopImportMetadata = async () => {
  try {
    await ipcRenderer.invoke('stop-import-sqlite')
    printMessage('warning', t('m.importStopped') || '导入已停止')
  } catch (e) {
    console.error('[Import] Stop error:', e)
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
        const message = `📦 缓存状态: 有效\n📊 标题数量: ${result.titleCount.toLocaleString()}\n📁 数据库: ${result.dbPath}\n⏱️ 已缓存: ${result.ageMinutes} 分钟\n⏳ 剩余时间: ${result.remainingMinutes} 分钟`
        
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
  if (librariesTabRef.value) {
    await librariesTabRef.value.resetWorkingLibraries()
  }
}

const libs = computed(() => setting.value.libraries || [])

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

.setting-tabs
  .el-tabs__content
    max-height: 70vh
    overflow-y: auto
    padding-right: 10px

</style>