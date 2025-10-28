<template>
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
</template>

<script setup>
const props = defineProps({
  setting: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['save-setting'])

const saveSetting = () => emit('save-setting')
</script>

<style lang="stylus">
.setting-switch
  text-align: left
  margin-top: 6px
</style>