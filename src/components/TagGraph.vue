<template>
  <el-dialog v-model="dialogVisibleGraph" fullscreen destroy-on-close>
    <template #header><p>{{$t('m.tagAnalysis')}}</p></template>
    <el-row>
      <el-col :span="12" class="graph-frame">
        <canvas id="graph-artist"></canvas>
      </el-col>
      <el-col :span="12" class="graph-frame">
        <canvas id="graph-mtime"></canvas>
      </el-col>
      <el-col :span="24" class="graph-frame">
        <canvas id="graph-tag-count"></canvas>
      </el-col>
    </el-row>
    <TagList
        ref="tagListRef"
        :title="tagListTitle"
        @search="handleSearch"
    />
  </el-dialog>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import Chart from 'chart.js/auto'
import TagList from './TagList.vue'

import { storeToRefs } from 'pinia'
import { useAppStore } from '../pinia.js'

const appStore = useAppStore()
const { setting } = storeToRefs(appStore)

const { t } = useI18n()

const emit = defineEmits(['search'])

const dialogVisibleGraph = ref(false)
const tagListRef = ref(null)
const tagListTitle = ref('')

// 处理搜索事件
const handleSearch = (query) => {
  emit('search', query)
  dialogVisibleGraph.value = false
}

const resolveTags = (tags) => {
  if (setting.value.showTranslation) {
    return tags.map(tag => appStore.translate(tag) || tag)
  }
  return tags
}

const displayTagGraph = async () => {
  dialogVisibleGraph.value = true
  await nextTick()

  // 使用TagList组件获取处理后的书籍信息
  const bookInfos = tagListRef.value.getBookInfos()
  
  // 检查是否有有效的书籍数据
  if (!bookInfos || bookInfos.length === 0) {
    console.warn('没有可用的书籍数据用于标签分析')
    return
  }

  console.log(`标签分析：处理 ${bookInfos.length} 本书籍`)
  
  const artists = _(bookInfos.map(book => book.artists)).flatten().filter(Boolean).countBy().toPairs().sortBy(p => -p[1]).slice(0, 20).value()
  console.log(`找到 ${artists.length} 个作者标签`)
  
  // 检查是否有数据
  if (artists.length === 0) {
    console.warn('没有作者标签数据，跳过作者图表')
  } else {
    const chartArtist = new Chart(
      document.getElementById('graph-artist'),
      {
        type: 'bar',
        options: {
          scales: {
            y: {
              beginAtZero: true
            }
          },
          layout: {
            padding: 10
          },
          onClick: (e, activeEls) => {
            if (activeEls.length === 0) return
            const artist = artists[activeEls[0].index][0]
            emit('search', `a:"${artist}"`)
            dialogVisibleGraph.value = false
          },
          plugins: {
            legend: {
              onClick: () => {
                tagListTitle.value = t('c.artist')
                tagListRef.value.showArtistTags()
              }
            }
          }
        },
        data: {
          labels: resolveTags(artists.map(p => p[0])),
          datasets: [{
            label: t('c.artist'),
            data: artists.map(p => p[1]),
            backgroundColor: 'rgba(255, 205, 86, 0.2)',
            borderColor: 'rgb(255, 205, 86)',
            borderWidth: 1
          }]
        }
      }
  )
  }

  const mtime = _(bookInfos.map(book => book.mtime)).filter(Boolean).countBy().toPairs().sortBy(p => p[0]).value()
  console.log(`找到 ${mtime.length} 个时间标签`)
  
  // 检查是否有数据
  if (mtime.length === 0) {
    console.warn('没有时间标签数据，跳过时间图表')
  } else {
    const chartMtime = new Chart(
      document.getElementById('graph-mtime'),
      {
        type: 'line',
        options: {
          scales: {
            y: {
              beginAtZero: true
            }
          },
          layout: {
            padding: 10
          },
          onClick: (e, activeEls) => {
            if (activeEls.length === 0) return
            if (activeEls[0].index < mtime.length - 1) {
              emit('search', `mtime:>=${mtime[activeEls[0].index][0]} mtime:<=${mtime[activeEls[0].index + 1][0]}`)
            } else {
              emit('search', `mtime:>=${mtime[activeEls[0].index][0]}`)
            }
            dialogVisibleGraph.value = false
          },
        },
        data: {
          labels: mtime.map(p => p[0]),
          datasets: [{
            label: t('m.mtime'),
            data: mtime.map(p => p[1]),
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            borderColor: 'rgb(75, 192, 192)',
            borderWidth: 1,
            fill: 'origin',
          }]
        }
      }
  )
  }

  const maleTags = _(bookInfos.map(book => book.male)).flatten().filter(Boolean).countBy().toPairs().sortBy(p => -p[1]).slice(0, 24).value()
  const femaleTags = _(bookInfos.map(book => book.female)).flatten().filter(Boolean).countBy().toPairs().sortBy(p => -p[1]).slice(0, 24).value()
  console.log(`找到 ${maleTags.length} 个男性标签，${femaleTags.length} 个女性标签`)
  
  let tagData = maleTags.map(p => {
    p[2] = 'rgba(54, 162, 235, 0.2)'
    p[3] = 'rgb(54, 162, 235)'
    return p
  })
      .concat(femaleTags.map(p => {
        p[2] = 'rgba(255, 99, 132, 0.2)'
        p[3] = 'rgb(255, 99, 132)'
        return p
      }))
  tagData = _.sortBy(tagData, p => -p[1]).slice(0, 24)
  
  // 检查是否有数据
  if (tagData.length === 0) {
    console.warn('没有标签数据，跳过标签图表')
  } else {
    const chartTagCount = new Chart(
      document.getElementById('graph-tag-count'),
      {
        type: 'bar',
        options: {
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true
            }
          },
          layout: {
            padding: 10
          },
          onClick: (e, activeEls) => {
            if (activeEls.length === 0) return
            const tag = tagData[activeEls[0].index]
            if (tag[3] === 'rgb(54, 162, 235)') {
              emit('search', `m:"${tag[0]}"`)
            } else {
              emit('search', `f:"${tag[0]}"`)
            }
            dialogVisibleGraph.value = false
          },
          plugins: {
            legend: {
              onClick: () => {
                tagListTitle.value = t('m.tag')
                tagListRef.value.showMixedTags()
              }
            }
          }
        },
        data: {
          labels: resolveTags(tagData.map(p => p[0])),
          datasets: [
            {
              label: t('m.tag'),
              data: tagData.map(p => p[1]),
              backgroundColor: tagData.map(p => p[2]),
              borderColor: tagData.map(p => p[3]),
              borderWidth: 1
            },
          ]
        }
      }
  )
  }
}

defineExpose({
  dialogVisibleGraph,
  displayTagGraph
})

</script>

<style lang="stylus">
.graph-frame, .graph-frame, .graph-frame
  height: calc(50vh - 52px)
</style>