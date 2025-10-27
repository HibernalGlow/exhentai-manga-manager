<template>
  <el-drawer v-model="sideVisibleFolderTree"
             :title="$t('m.folderTree')"
             direction="ltr"
             :size="setting.folderTreeWidth ? setting.folderTreeWidth : '28%'"
             modal-class="side-tree-modal"
             @close="closeFolderTree"
  >
    <el-tabs v-model="activeTreeTab" class="tree-tabs">
      <!-- Folder -->
      <el-tab-pane label="Folder" name="folder">
        <div ref="folderToolbarRef" class="folder-toolbar"
             style="display:flex; flex-direction:column; gap:8px; margin-bottom:8px;">
          <!-- 第一行：搜索和展开/折叠按钮 -->
          <div style="display:flex; gap:8px; align-items:center;">
            <!--  Search bar        -->
            <el-input
                class="folder-search"
                v-model="treeFilterText"
                placeholder='Search folder'
                clearable
                size="default"
                @input="() => treeRef?.filter?.(treeFilterText)"
                style="flex:1"
            ></el-input>
            <!-- Side buttons -->
            <div class="icon-group">
              <el-tooltip content="Select untagged" placement="top">
                <el-button
                    size="default"
                    circle
                    :icon="Warning"
                    aria-label="Select untagged"
                    @click="selectUntaggedFolders"
                />
              </el-tooltip>
              <!--    Expand all /   -->
              <el-tooltip content="Expand all" placement="top">
                <el-button
                    size="default"
                    circle
                    :icon="CirclePlusFilled"
                    aria-label="Expand all"
                    @click="expandAll"
                />
              </el-tooltip>
              <!-- Collapse all -->
              <el-tooltip content="Collapse all" placement="top">
                <el-button
                    size="default"
                    circle
                    :icon="RemoveFilled"
                    aria-label="Collapse all"
                    @click="collapseAll"
                />
              </el-tooltip>
            </div>
          </div>
          
          <!-- 第二行：批量操作按钮组（可折叠） -->
          <el-collapse v-model="batchActionsExpanded" style="border:none;">
            <el-collapse-item name="batch" style="border:none;">
              <template #title>
                <span style="font-size:12px; color:var(--el-text-color-secondary);">
                  批量操作 ({{ checkedNodes.length }} 个文件夹已选)
                </span>
              </template>
              <div class="batch-actions-buttons" style="display:flex; flex-direction:column; gap:4px; padding:4px 0;">
                <el-button 
                  size="small" 
                  type="primary"
                  :disabled="checkedNodes.length === 0"
                  @click="batchUpdateArtistGroup(checkedNodes)"
                  style="width:100%;"
                >
                  🎨 批量修改画师/社团标签
                </el-button>
                <el-button 
                  size="small" 
                  type="primary"
                  :disabled="checkedNodes.length === 0"
                  @click="batchUpdateCoser(checkedNodes)"
                  style="width:100%;"
                >
                  📸 批量修改Coser标签
                </el-button>
              </div>
            </el-collapse-item>
          </el-collapse>
        </div>
        <!--  Show all row    -->
        <button
            class="fake-tree-row"
            type="button"
            @click="resetSelect"
            title="Show all books"
        >
          <el-icon class="fake-tree-row__icon">
            <Folder/>
          </el-icon>
          <span class="fake-tree-row__label">All</span>
        </button>
        <!--        :filter-node-method="filterTreeNode"-->
        <div class="folder-tree-container">
          <el-tree-v2
              ref="treeRef"
              :data="folderTreeData"
              node-key="folderPath"
              :props="{ value: 'folderPath', label: 'label', children: 'children' }"
              :expand-on-click-node="false"
              :expanded-keys="expandedKeys"
              :filter-method="filterTreeNode"
              @current-change="selectFolderTreeNode"
              :height="treeHeight"
              :item-size="28"
              show-checkbox
              :check-strictly="false"
              @check="handleCheckChange"
          >
            <template #default="{ data }">
              <div class="custom-tree-node">
                <span class="node-label">{{ data.label }}</span>
                <el-tag v-if="data.untaggedCount > 0" type="warning" size="small" effect="dark" round class="untagged-badge">
                  {{ data.untaggedCount }}
                </el-tag>
              </div>
            </template>
          </el-tree-v2>
        </div>
        <el-button class="tree-backtop" circle @click="treeRef.scrollTo(0)" title="Back to top">
          <el-icon>
            <ArrowUp/>
          </el-icon>
        </el-button>
      </el-tab-pane>
      <!-- Artist -->
      <el-tab-pane label="Artist" name="artist">
        <div ref="artistToolbarRef" class="artist-toolbar"
             style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
          <el-input
              class="artist-search"
              v-model="artistFilterText"
              placeholder="Search artist"
              clearable
              @input="() => treeArtistRef?.filter?.(artistFilterText)"
              style="flex:1"
          />
          <el-select v-model="artistSortMode" style="width: 30%;" placeholder="Sort by" @change="rebuildArtist">
            <template #prefix>
              <span>⇅</span>
            </template>
            <el-option label="En" value="alpha"/>
            <el-option label="譯" value="tr"/>
            <el-option label="#" value="count"/>
          </el-select>
        </div>
        <!--    virtualized tree in el-tree-v2 is necessary when entries > 10000   -->
        <el-tree-v2
            ref="treeArtistRef"
            :data="artistTreeNodes"
            node-key="artistPath"
            :props="{ value: 'artistPath',  label: 'label' }"
            :expand-on-click-node="false"
            :filter-method="filterNode"
            @current-change="onArtistNodeClick"
            :height="treeHeight"
            :item-size="28"
        />
        <el-button class="tree-backtop" circle @click="treeArtistRef.scrollTo(0)" title="Back to top">
          <el-icon>
            <ArrowUp/>
          </el-icon>
        </el-button>
      </el-tab-pane>
      <!-- Group -->
      <el-tab-pane label="Group" name="group">
        <div class="group-toolbar" style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
          <el-input
              class="group-search"
              v-model="groupFilterText"
              placeholder="Search group"
              clearable
              @input="() => treeGroupRef?.filter?.(groupFilterText)"
              style="flex:1"
          />
          <el-select v-model="groupSortMode" style="width: 30%;" placeholder="Sort by" @change="rebuildGroup">
            <template #prefix>
              <span>⇅</span>
            </template>
            <el-option label="En" value="alpha"/>
            <el-option label="譯" value="tr"/>
            <el-option label="#" value="count"/>
          </el-select>
        </div>

        <el-tree-v2
            ref="treeGroupRef"
            :data="groupTreeNodes"
            node-key="groupPath"
            :props="{ value: 'groupPath',  label: 'label' }"
            :expand-on-click-node="false"
            :filter-method="filterNode"
            @current-change="onGroupNodeClick"
            :height="treeHeight"
            :item-size="28"
        />
        <el-button class="tree-backtop" circle @click="treeGroupRef.scrollTo(0)" title="Back to top">
          <el-icon>
            <ArrowUp/>
          </el-icon>
        </el-button>
      </el-tab-pane>
      <!-- Parody -->
      <el-tab-pane label="Parody" name="parody">
        <div class="group-toolbar" style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
          <el-input
              class="parody-search"
              v-model="parodyFilterText"
              placeholder="Search group"
              clearable
              @input="() => treeParodyRef?.filter?.(parodyFilterText)"
              style="flex:1"
          />
          <el-select v-model="parodySortMode" style="width: 30%;" placeholder="Sort by" @change="rebuildParody">
            <template #prefix>
              <span>⇅</span>
            </template>
            <el-option label="En" value="alpha"/>
            <el-option label="譯" value="tr"/>
            <el-option label="#" value="count"/>
          </el-select>
        </div>
        <el-tree-v2
            ref="treeParodyRef"
            :data="parodyTreeNodes"
            node-key="parodyPath"
            :props="{value:'parodyPath',label: 'label' }"
            :expand-on-click-node="false"
            :filter-method="filterNode"
            @current-change="onParodyNodeClick"
            :height="treeHeight"
            :item-size="28"
        />
        <el-button class="tree-backtop" circle @click="treeParodyRef.scrollTo(0)" title="Back to top">
          <el-icon>
            <ArrowUp/>
          </el-icon>
        </el-button>
      </el-tab-pane>
    </el-tabs>
  </el-drawer>

</template>

<script setup>
// auto regenerated after scan/rebuid/patch
// regenerated in pushAppCache, called in loadCollectionList, called in loadBookList (App.vue)
import { ArrowUp, CirclePlusFilled, Folder, RemoveFilled } from '@element-plus/icons-vue'
import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef, unref } from 'vue'
import { storeToRefs } from 'pinia'
import { useAppStore } from '../pinia.js'

const appStore = useAppStore()
const { translate } = appStore
const { setting, bookList, tagListRaw } = storeToRefs(appStore)

// they are used in this component only, so no need to call from appStore
const folderTreeData = shallowRef([])
const artistTreeData = shallowRef([])
const groupTreeData = shallowRef([])
const parodyTreeData = shallowRef([])


// default stays folder, or artist, group, parody
const activeTreeTab = ref('folder')
// artist tab state
const artistFilterText = ref('')
const groupFilterText = ref('')
const parodyFilterText = ref('')
const artistSortMode = ref('alpha') // default sort, or count
const groupSortMode = ref('alpha') // default sort, or count
const parodySortMode = ref('alpha') // default sort, or count

const artistTreeNodes = ref([])
const groupTreeNodes = ref([])
const parodyTreeNodes = ref([])

// const treeFolderRef = ref()
const treeArtistRef = shallowRef()
const treeGroupRef = shallowRef()
const treeParodyRef = shallowRef()
const emit = defineEmits(['chunkList', 'search'])

const sideVisibleFolderTree = ref(false)
const isFolderTreeInit = ref(false)

// 多选相关状态
const checkedNodes = ref([])
const lastClickedNode = ref(null)
const batchActionsExpanded = ref(['batch']) // 默认展开批量操作面板

function openFolderTree() {
  sideVisibleFolderTree.value = true
  if (!isFolderTreeInit.value) geneFolderTree()

}

function closeFolderTree() {
  sideVisibleFolderTree.value = false
}

/** =======================  / construct folder tree
 **/
function buildFolderTree(books) {
// bookPathList: [ path string, ... ]
// Output node: { label, folderName, folderPath, children:[...] }

  // Trie node factory
  const makeNode = (name, path) => ({
    folderName: name,
    folderPath: path,
    hasDirect: false,        // at least one file directly in this folder
    _children: new Map(),
    untaggedCount: 0,
  })

  // Build trie
  const rootMap = new Map()
  for (const book of books || []) {
    const fp = normDir(book.filepath)
    if (!fp) continue

    const parts = fp.split('/').slice(0, -1).filter(Boolean) // drop filename
    if (!parts.length) continue

    const isUntagged = book.status === 'non-tag' || book.status === 'tag-failed';

    let cursor = rootMap
    let accum = []
    const parentNodes = [];
    for (let i = 0; i < parts.length; i++) {
      const seg = parts[i]
      accum.push(seg)
      let node = cursor.get(seg)
      if (!node) {
        node = makeNode(seg, accum.join('/'))
        cursor.set(seg, node)
      }
      parentNodes.push(node);
      if (i === parts.length - 1) {
        // file belongs directly under this folder
        node.hasDirect = true
      }
      cursor = node._children
    }
    if (isUntagged) {
      parentNodes.forEach(p => p.untaggedCount++);
    }
  }

  // ---- Convert to Element-Plus-friendly array ----
  const toArray = (map, isTop) => {
    const arr = []
    for (const [, n] of map) {
      const children = toArray(n._children, false)
      const untaggedCount = n.untaggedCount;
      let label = isTop ? n.folderPath : n.folderName;

      arr.push({
        label: label, // full path at top, name below
        folderName: n.folderName,
        folderPath: n.folderPath,                    // stable node-key
        children: children,
        untaggedCount: untaggedCount,
      })
    }
    // Sort: top by full path, deeper by name
    arr.sort((a, b) =>
        (isTop ? a.folderPath : a.folderName).localeCompare(isTop ? b.folderPath : b.folderName, undefined,
            { numeric: true, sensitivity: 'base' }),
    )
    return arr
  }

  return toArray(rootMap, true)
}

let dirIndex = { keys: [], idxs: [] } // precomputed directory index for fast lookup

const geneFolderTree = async (tagListRaw) => {
  // always (re)build the folder tab;
  const booksForTree = bookList.value.filter(b => !b.isCollection)
  folderTreeData.value = buildFolderTree(booksForTree)
  const { keys, idxs } = buildDirIndex(bookList.value)
  dirIndex = { keys, idxs }
  // build the rest tabs

  // 使用现有的 tagListRaw 计算属性来构建标签树
  const buildTagTree = (category) => {
    const tags = (tagListRaw || []).filter(tag => tag.id.startsWith(category + ':'))
    return tags.map(tag => ({
      id: tag.id,
      label: tag.label,
      children: []
    }))
  }

  artistTreeData.value = buildTagTree('artist')
  groupTreeData.value = buildTagTree('group')
  parodyTreeData.value = buildTagTree('parody')


  isFolderTreeInit.value = true
  rebuildArtist()
  rebuildGroup()
  rebuildParody()
}

function loadTreeCache(cacheFolderTree) {
  // prevent watchers from doing expensive work during restore
  appStore.suppressWatchers = true
  // One atomic patch so dependent watchers/computeds see a consistent state

  appStore.$patch((state) => {
    dirIndex = cacheFolderTree.dirIndex
    // trees
    folderTreeData.value = cacheFolderTree.folderTreeData
    artistTreeData.value = cacheFolderTree.artistTreeData
    groupTreeData.value = cacheFolderTree.groupTreeData
    parodyTreeData.value = cacheFolderTree.parodyTreeData
    // tag translations
    artistTreeNodes.value = cacheFolderTree.artistTreeNodes
    groupTreeNodes.value = cacheFolderTree.groupTreeNodes
    parodyTreeNodes.value = cacheFolderTree.parodyTreeNodes
    isFolderTreeInit.value = true
  })
  appStore.suppressWatchers = false
}


async function geneSaveTreeCache() {
  if (!isFolderTreeInit.value) {
    await geneFolderTree()
  }


  return {
    dirIndex,
    folderTreeData: folderTreeData.value,
    artistTreeData: artistTreeData.value,
    groupTreeData: groupTreeData.value,
    parodyTreeData: parodyTreeData.value,
    artistTreeNodes: artistTreeNodes.value,
    groupTreeNodes: groupTreeNodes.value,
    parodyTreeNodes: parodyTreeNodes.value,
  }

}


/** Display files by book path
 * Precompute a sorted directory index and use binary search prefix ranges on click to fetch the books under any folder
 * No need to compare each path with the selected folder path
 * */

// Always normalize to POSIX-style '/' and trim trailing '/'
// Lower-case Windows drive letters for case-insensitive compare
function normDir(p) {
  let s = String(p || '').replace(/[\\/]+/g, '/')
  if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1)
  if (/^[A-Za-z]:/.test(s)) s = s.toLowerCase() // make Windows case-insensitive
  return s
}

// 1) Build a compact directory index once
function buildDirIndex(bookList) {
  const keys = []   // directory path (string)
  const idxs = []   // index into bookList
  for (let i = 0; i < bookList.length; i++) {
    const b = bookList[i]
    // if (b.isCollection) continue;
    const p = b.filepath
    const j = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
    const dir = j >= 0 ? p.slice(0, j) : ''
    keys.push(normDir(dir))
    idxs.push(i)
  }
  // sort by keys, keep idxs in sync
  const order = keys.map((_, i) => i).sort((a, b) => {
    const ka = keys[a], kb = keys[b]
    return ka < kb ? -1 : ka > kb ? 1 : 0
  })

  const sKeys = new Array(order.length)
  const sIdxs = new Array(order.length)
  for (let k = 0; k < order.length; k++) {
    const i = order[k]
    sKeys[k] = keys[i]
    sIdxs[k] = idxs[i]
  }
  return { keys: sKeys, idxs: sIdxs }
}

// 2) Binary search helpers
function lowerBound(keys, key) {
  let lo = 0, hi = keys.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (keys[mid] < key) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  return lo
}

function upperBound(keys, key) {
  let lo = 0, hi = keys.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (keys[mid] <= key) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  return lo
}

function computeRange(keys, folderPath) {
  const loKey = normDir(folderPath)
  const hiKey = loKey + '/\uFFFF\uFFFF'// any subdir under base/
  return [lowerBound(keys, loKey), upperBound(keys, hiKey)]
}

// 3) Click handler with per-node cache (_range = [lo, hi])

function selectFolderTreeNode(selectNode) {
  console.log('selectFolderTreeNode 被调用:', selectNode)
  if (!selectNode?.folderPath) return
  // reset visibility first
  bookList.value.forEach(b => { b.folderHide = true })
  if (!selectNode._range) {
    selectNode._range = computeRange(dirIndex.keys, selectNode.folderPath)
  }
  const [lo, hi] = selectNode._range

  // const out = new Array(hi - lo)
  for (let i = lo; i < hi; i++) {
    // out[k] = bookList.value[dirIndex.idxs[i]] // <-- use .value
    bookList.value[dirIndex.idxs[i]].folderHide = false
  }
  emit('chunkList')
}


onMounted(async () => {
  recomputeTreeHeight()
  window.addEventListener('resize', recomputeTreeHeight)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', recomputeTreeHeight)
  
  // 清理可能的事件监听器
  if (window.ipcRenderer && window.ipcRenderer.removeAllListeners) {
    // 注意：不要移除所有监听器，只移除我们添加的
    // 这里暂时不做处理，因为我们没有添加任何持久的监听器
  }
})

const treeFilterText = ref('')
const treeRef = ref()

const filterTreeNode = (query, data) => {
  const q = String(query ?? '').trim().toLowerCase()
  if (!q) return true

  const label = String(data?.label ?? '').toLowerCase()
  const folderPath = String(data?.folderPath ?? '').toLowerCase()
  return label.includes(q) || folderPath.includes(q)
}
const resetSelect = () => {
  treeRef.value && treeRef.value.setCurrentKey('')
  bookList.value.forEach(b => { b.folderHide = false })
  emit('chunkList')
}

// expand/collapse all
const expandedKeys = ref([])         // controlled list
const _expandedSet = new Set()       // fast membership

// Collect all folderPath keys in the tree

function collectAllKeys(nodes, out = []) {
  const list = Array.isArray(nodes) ? nodes : (unref(nodes) || [])
  for (const n of list) {
    if (n?.children?.length) {
      out.push(n.folderPathKey || n.folderPath)     // prefer the string key
      collectAllKeys(n.children, out)
    }
  }
  return out
}

function expandAll() {
  const all = collectAllKeys(folderTreeData)
  _expandedSet.clear()
  for (const k of all) _expandedSet.add(k)

  expandedKeys.value = [..._expandedSet]
  nextTick(() => {
    treeRef.value?.setExpandedKeys?.(expandedKeys.value)
  })
}

function collapseAll() {
  _expandedSet.clear()
  expandedKeys.value = []
  nextTick(() => {
    treeRef.value?.setExpandedKeys?.([])
  })
}

/** Additional Tags */

// sorting helpers, Parody is in Chinese
const collatorZh = new Intl.Collator(['zh-Hans', 'zh-Hant', 'en'], {
  sensitivity: 'base', numeric: true, ignorePunctuation: true, collation: 'pinyin',
})
// group and artist are in Japanese
const collatorJa = new Intl.Collator(['ja-JP-u-co-phonebk'], {
  sensitivity: 'base', numeric: true, ignorePunctuation: true,
})
// Unicode ranges
const reKana = /[\u3040-\u30FF\u31F0-\u31FF\uFF66-\uFF9D]/   // Hiragana, Katakana, Katakana Phonetic, Halfwidth Katakana
const reCJK = /[\u4E00-\u9FFF]/                              // CJK Unified Ideographs (basic block)
const reLatin = /[A-Za-z]/
const reDigit = /[0-9]/

const rankScript = s => {
  for (const ch of s) {
    if (reKana.test(ch)) return 1  // JP
    if (reCJK.test(ch)) return 1  // ZH (CJK)
    if (reLatin.test(ch)) return 2  // EN
    if (reDigit.test(ch)) return 3  // Numbers
    // else keep scanning until we hit a meaningful char
  }
  return 4 // Other/symbols
}

const idMapByNS = new Map()

function makeStableId(ns, name) {
  let map = idMapByNS.get(ns)
  if (!map) {
    map = new Map()
    idMapByNS.set(ns, map)
  }
  const n = (map.get(name) || 0) + 1
  map.set(name, n)
  return n === 1
      ? `${ns}:${encodeURIComponent(name)}`
      : `${ns}:${encodeURIComponent(name)}#${n}`
}

const makeSortKey = s => `${rankScript(s)}|${s.toLowerCase()}`
const sortCache = new Map()
const sortNodesWithCache = (treeData, nodeKey, nodeName, sortMode) => {
  //nodeName: artist|group|parody
  const cacheKey = `${nodeName}:${nodeKey}:${sortMode}`
  const cache = sortCache.get(cacheKey)
  if (cache) return cache // toRaw(unref(treeData))
  const list = (treeData ?? []).filter(
      (x) => x && typeof x.name === 'string',
  )
  const nodes = list.map(({ name, jp, count }) => {
    return {
      label: `${jp}(${name}) (${Number(count) || 0})`, // shown in el-tree
      rawName: name,                             // used by filter
      sortKey: makeSortKey(jp || name),       // used by sorting
      allName: `${name} ${jp || name}`.toLowerCase(), // used by filter
      count: Number(count) || 0,                // used by sorting
      [nodeKey]: makeStableId(nodeName, name),         // dynamic property name
    }
  })

  if (sortMode === 'count') {
    nodes.sort((a, b) => (b.count - a.count) || a.rawName.localeCompare(b.rawName))
  } else if (sortMode === 'tr') {
    if (nodeName === 'parody') {
      nodes.sort((a, b) => collatorZh.compare(a.sortKey, b.sortKey))
    } else {
      nodes.sort((a, b) => collatorJa.compare(a.sortKey, b.sortKey))
    }
  } else {
    nodes.sort((a, b) => a.rawName.localeCompare(b.rawName))
  }
  sortCache.set(cacheKey, nodes)

  return nodes
}

function rebuildArtist() {
  artistTreeNodes.value = sortNodesWithCache(artistTreeData.value, 'artistPath', 'artist', artistSortMode.value)
}

function rebuildGroup() {
  groupTreeNodes.value = sortNodesWithCache(groupTreeData.value, 'groupPath', 'group', groupSortMode.value)
}

function rebuildParody() {
  parodyTreeNodes.value = sortNodesWithCache(parodyTreeData.value, 'parodyPath', 'parody', parodySortMode.value)
}

// filter for artist/group
const filterNode = (query, data) => {
  const q = String(query ?? '').trim().toLowerCase()
  if (!q) return true
  // allName is pre-lowercased when you build artistTreeNodes
  return String(data?.allName ?? '').includes(q)
}

// response to artist/group node click
const handleSearch = (value) => {
  bookList.value.map(book => book.folderHide = false)
  emit('search', value)
}
const onArtistNodeClick = async (selectNode) => {
  handleSearch(`a:"${selectNode.rawName}"`)
}
const onGroupNodeClick = async (selectNode) => {
  handleSearch(`g:"${selectNode.rawName}"`)
}
const onParodyNodeClick = async (selectNode) => {
  handleSearch(`p:"${selectNode.rawName}"`)
}

// Translation

function makeNameTranslator(section) {
  const cache = new Map()
  return (name) => {
    const k = String(name || '')
    if (cache.has(k)) return cache.get(k)
    const out = (section && section[k]) || k
    cache.set(k, out)
    return out
  }
}

//  Attach translation using a translator fn (fallback-safe)
function attachTranslation(list, translator, category, type = 'name') {
  const arr = Array.isArray(list) ? list : []
  return arr.map(({ name, count }) => ({
    name,
    jp: translator(name, category, { type }),
    count: Number(count) || 0,
  }))
}


// dynamically adjust the virtual window in tabs
// use rule of thumb; change the 200 if needed
// 增加高度偏移量以适应新的批量操作面板
const treeHeight = ref(Math.max(120, window.innerHeight - 280))

function recomputeTreeHeight() {
  treeHeight.value = Math.max(120, window.innerHeight - 280)
}

// 处理勾选变化
function handleCheckChange(data, checked) {
  checkedNodes.value = treeRef.value?.getCheckedKeys() || []
  console.log('选中的文件夹数量:', checkedNodes.value.length)
}

// 批量更新画师/社团标签
async function batchUpdateArtistGroup(folders) {
  const ipcRenderer = window.ipcRenderer
  const { ElMessageBox, ElLoading } = await import('element-plus')
  
  try {
    // 将文件夹路径数组转换为纯字符串数组（避免对象克隆问题）
    const folderPaths = Array.isArray(folders) ? [...folders] : []
    
    if (folderPaths.length === 0) {
      appStore.printMessage('warning', '请先选择文件夹')
      return
    }
    
    // 显示确认对话框
    await ElMessageBox.confirm(
      `将会修改 ${folderPaths.length} 个文件夹下的书籍画师/社团标签：
      
• 统计文件夹中所有书籍的标签（包括已标记的）
• 找出出现最多的画师/社团标签
• 只修改状态为 "non-tag" 或 "tag-failed" 且没有该标签的书籍
• 此操作不可撤销

是否继续？`,
      '批量修改确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
        dangerouslyUseHTMLString: false
      }
    )
    
    // 显示加载提示
    const loading = ElLoading.service({
      lock: true,
      text: '正在批量更新标签...',
      background: 'rgba(0, 0, 0, 0.7)'
    })
    
    try {
      const result = await ipcRenderer.invoke('batch-update-artist-group-tags', folderPaths)
      loading.close()
      
      if (result.success) {
        appStore.printMessage('success', `成功更新 ${result.updatedCount} 个文件`)
        
        // 重新从数据库加载书籍列表
        console.log('🔄 重新加载书籍列表...')
        const books = await ipcRenderer.invoke('load-book-list')
        if (books && Array.isArray(books)) {
          bookList.value = books
          console.log(`✅ 已重新加载 ${books.length} 本书`)
        }
        
        // 刷新显示
        emit('chunkList')
      } else {
        appStore.printMessage('error', result.message || '更新失败')
      }
    } catch (error) {
      loading.close()
      throw error
    }
  } catch (error) {
    if (error === 'cancel') {
      // 用户取消操作
      return
    }
    console.error('批量更新画师/社团标签失败:', error)
    appStore.printMessage('error', '更新失败: ' + error.message)
  }
}

// 批量更新Coser标签
async function batchUpdateCoser(folders) {
  const ipcRenderer = window.ipcRenderer
  const { ElMessageBox, ElLoading } = await import('element-plus')
  
  try {
    // 将文件夹路径数组转换为纯字符串数组（避免对象克隆问题）
    const folderPaths = Array.isArray(folders) ? [...folders] : []
    
    if (folderPaths.length === 0) {
      appStore.printMessage('warning', '请先选择文件夹')
      return
    }
    
    // 显示确认对话框
    await ElMessageBox.confirm(
      `将会修改 ${folderPaths.length} 个文件夹下的书籍Coser标签：
      
• 统计文件夹中所有书籍的标签（包括已标记的）
• 找出出现最多的Coser标签
• 只修改状态为 "non-tag" 或 "tag-failed" 且没有该标签的书籍
• 此操作不可撤销

是否继续？`,
      '批量修改确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
        dangerouslyUseHTMLString: false
      }
    )
    
    // 显示加载提示
    const loading = ElLoading.service({
      lock: true,
      text: '正在批量更新标签...',
      background: 'rgba(0, 0, 0, 0.7)'
    })
    
    try {
      const result = await ipcRenderer.invoke('batch-update-coser-tags', folderPaths)
      loading.close()
      
      if (result.success) {
        appStore.printMessage('success', `成功更新 ${result.updatedCount} 个文件`)
        
        // 重新从数据库加载书籍列表
        console.log('🔄 重新加载书籍列表...')
        const books = await ipcRenderer.invoke('load-book-list')
        if (books && Array.isArray(books)) {
          bookList.value = books
          console.log(`✅ 已重新加载 ${books.length} 本书`)
        }
        
        // 刷新显示
        emit('chunkList')
      } else {
        appStore.printMessage('error', result.message || '更新失败')
      }
    } catch (error) {
      loading.close()
      throw error
    }
  } catch (error) {
    if (error === 'cancel') {
      // 用户取消操作
      return
    }
    console.error('批量更新Coser标签失败:', error)
    appStore.printMessage('error', '更新失败: ' + error.message)
  }
}

defineExpose({
  sideVisibleFolderTree,
  openFolderTree,
  geneFolderTree,
  resetSelect,
  loadTreeCache,
  geneSaveTreeCache
})

</script>

<style lang="stylus">
.side-tree-modal
  background-color: var(--el-mask-color-extra-light)

  .el-drawer__body
    padding-top: 0

  .folder-search
    margin-bottom: 8px

// floating side bar in the folder tab
.folder-tree-wrap {
  position: relative;
}

.tree-backtop {
  position: absolute;
  right: 10px;
  bottom: 10px;
  z-index: 2;
}

.folder-toolbar {
  display: flex; /* ② */
  align-items: center; /* ② */
  gap: 8px;
  margin-bottom: 8px;
}

// collapse expand buttons in the folder tab
.folder-toolbar .folder-search {
  flex: 1; /* input takes remaining width */
}

/* ③ ensure tooltip wrapper aligns like a flex item */
.folder-toolbar .toolbar-tip {
  display: flex;
  align-items: center;
}

.folder-toolbar .el-button.is-circle {
  width: 32px;
  height: 32px;
  padding: 0;

}

.icon-group {
  display: flex;
  align-items: center;
  gap: 0; /* smaller gap just between the two icons */
  margin-bottom: 10px
  width: 30%
}

// fake "All" row at the top of folder tree
.fake-tree-row {
  display: flex;
  align-items: center;
  height: 28px; /* match :item-size */
  //padding: 0 8px 0 12px;
  width: 100%;
  border: 0;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.fake-tree-row:hover {
  background: var(--el-fill-color-light);
}

.fake-tree-row.active {
  background: var(--el-color-primary-light-9);
}

.fake-tree-row__icon {
  margin-right: 6px;
  line-height: 1;
}

.fake-tree-row__label {
  font-size: 14px;
}

.folder-tree-container {
  position: relative;
  width: 100%;
}

.custom-tree-node {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: space-between;
  padding-right: 8px;
  overflow: hidden;
}

.node-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>