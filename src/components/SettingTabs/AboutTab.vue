<template>
  <div>
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
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  version: {
    type: String,
    required: true
  }
})

const emit = defineEmits([
  'open-link',
  'auto-check-updates'
])

const openLink = (link) => emit('open-link', link)
const autoCheckUpdates = (forceShowDialog) => emit('auto-check-updates', forceShowDialog)
</script>

<style lang="stylus">
.about-logo
  width: 160px
  position: absolute
  right: 40px
  top: 10px
</style>