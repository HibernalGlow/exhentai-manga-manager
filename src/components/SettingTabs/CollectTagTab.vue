<template>
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
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Search } from '@element-plus/icons-vue'
import draggable from 'vuedraggable'

const { t } = useI18n()

const props = defineProps({
  setting: {
    type: Object,
    required: true
  },
  tagListRaw: {
    type: Array,
    default: () => []
  },
  resolvedTranslation: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['save-setting'])

const collectTagSearch = ref('')
const formTagAdd = ref({
  tag: null,
  color: '#42A5F5',
  colorMode: 'auto', // auto, random, custom
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

// 监听标签选择变化，自动更新颜色预览
watch(() => formTagAdd.value.tag, (newTagId) => {
  if (newTagId && formTagAdd.value.colorMode === 'auto') {
    const tag = props.tagListRaw.find(tag => tag.id === newTagId)
    if (tag) {
      formTagAdd.value.color = generateColorFromTag(tag.tag)
    }
  }
})

const tagListForCollect = computed(() => {
  if (props.setting.showTranslation) {
    return props.tagListRaw.map(({ letter, cat, tag, id }) => {
      const labelHeader = cat === 'group' ? '团队' : props.resolvedTranslation[cat]?.name || cat
      const labelTail = props.resolvedTranslation[tag]?.name || tag
      return {
        label: `${labelHeader}:${labelTail} || ${letter}:"${tag}"$`,
        value: id,
      }
    })
  } else {
    return props.tagListRaw.map(({ letter, cat, tag, id }) => {
      return {
        label: `${cat}:${tag} || ${letter}:"${tag}"$`,
        value: id,
      }
    })
  }
})

const groupedCollectTags = computed(() => {
  const groups = {}
  if (!props.setting.collectTag) return []

  // 过滤标签
  let filteredTags = props.setting.collectTag

  if (collectTagSearch.value.trim()) {
    const searchTerm = collectTagSearch.value.trim().toLowerCase()
    filteredTags = props.setting.collectTag.filter(tag => {
      // 搜索英文标签名
      const englishMatch = tag.tag.toLowerCase().includes(searchTerm)
      
      // 搜索中文翻译
      const chineseMatch = props.setting.showTranslation && 
        props.resolvedTranslation[tag.tag]?.name?.toLowerCase().includes(searchTerm)
      
      // 搜索类别
      const categoryMatch = tag.cat.toLowerCase().includes(searchTerm)
      
      // 搜索类别中文翻译
      const categoryChineseMatch = props.setting.showTranslation && 
        (tag.cat === 'group' ? '团队' : props.resolvedTranslation[tag.cat]?.name)?.toLowerCase().includes(searchTerm)
      
      return englishMatch || chineseMatch || categoryMatch || categoryChineseMatch
    })
  }

  filteredTags.forEach(tag => {
    const category = props.setting.showTranslation
      ? (tag.cat === 'group' ? '团队' : props.resolvedTranslation[tag.cat]?.name || tag.cat)
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
  const tag = props.tagListRaw.find(tag => tag.id === formTagAdd.value.tag)
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
  const tag = props.tagListRaw.find(tag => tag.id === formTagAdd.value.tag)
  if (!props.setting.collectTag) props.setting.collectTag = []
  
  // 根据模式生成颜色
  let finalColor = formTagAdd.value.color
  if (formTagAdd.value.colorMode === 'auto') {
    finalColor = generateColorFromTag(tag.tag)
  } else if (formTagAdd.value.colorMode === 'random') {
    finalColor = getRandomColor()
  }
  
  props.setting.collectTag.push({
    id: tag.id,
    letter: tag.letter,
    cat: tag.cat,
    tag: tag.tag,
    color: finalColor,
  })
  props.setting.collectTag = _.uniqBy(props.setting.collectTag, 'id')
  formTagAdd.value.tag = null
  saveSetting()
}

const removeTag = (id) => {
  props.setting.collectTag = props.setting.collectTag.filter(tag => tag.id !== id)
  saveSetting()
}

const saveSetting = () => emit('save-setting')
</script>

<style lang="stylus">
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
  font-size: 12px;
  color: var(--el-text-color-secondary);
  background: var(--el-color-primary);
  color: white;
  padding: 2px 6px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
}

.category-tags {
  padding-left: 4px;
}
</style>