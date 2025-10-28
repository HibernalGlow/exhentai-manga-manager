<template>
  <el-row :gutter="8">
    <!-- Row: quick actions -->
    <el-col :span="24">
      <div class="setting-line">
        <el-form-item :label="$t('m.library')" class="lib-line" style="margin-right:auto">
          <el-button type="primary" style="margin-left:auto" size="small" plain @click="addLibraries">
            {{$t('m.addFolder') || 'Add folders…'}}
          </el-button>
        </el-form-item>
      </div>
    </el-col>

    <!-- Row: list (sortable, removable) -->
    <el-table
        ref='libTableRef'
        :data="workingLibraries"
        max-height="260"
        border
        fit
        stripe
        highlight-current-row
        @current-change="onRowSelect"
    >
      <el-table-column type="index" label="#" width="40" class-name="col-index"/>

      <el-table-column :label="$t('m.path') || 'Path'" class-name="col-path">
        <template #default="{ row }">
          <el-tooltip :content="row.path" placement="top">
            <span class="libpath">{{row.path}}</span>
          </el-tooltip>
        </template>
      </el-table-column>

      <el-table-column
          :label="$t('m.status') || 'Status'"
          width="90"
          fixed="right"
          class-name="col-right"
      >
        <template #default="{ row }">
          <el-tag v-if="row.exists" type="success" size="small" effect="light">
            {{$t('m.exists') || 'Exists'}}
          </el-tag>
          <el-tag v-else type="warning" size="small" effect="light">
            {{$t('m.missing') || 'Missing'}}
          </el-tag>
        </template>
      </el-table-column>

      <!-- Actions (flush right, far right) -->
      <el-table-column
          :label="$t('m.actions') || 'Actions'"
          width="90"
          fixed="right"
          class-name="col-right"
      >
        <template #default="{ $index }">
          <el-button size="small" type="danger" plain @click="removeAt($index)">
            {{$t('m.remove') || 'Remove'}}
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- Row: footer buttons -->
    <el-col :span="24">
      <div class="setting-line" style="display:flex; justify-content:flex-end; gap:8px; padding-top:10px">
        <el-button size="small" @click="openInOS" :disabled="!currentPath">
          {{$t('m.reveal') || 'Reveal in OS'}}
        </el-button>
        <el-button size="small" type="success" @click="saveLibraries">{{$t('m.save') || 'Save'}}</el-button>
      </div>
    </el-col>
  </el-row>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'

const { t } = useI18n()

const props = defineProps({
  setting: {
    type: Object,
    required: true
  }
})

const emit = defineEmits([
  'save-setting',
  'add-libraries',
  'save-libraries',
  'open-in-os'
])

const workingLibraries = ref([])
const libTableRef = ref(null)
const currentPath = ref('')

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

async function checkLibraryFoldersMissing(paths) {
  try {
    const res = await window.ipcRenderer.invoke('fs:exists-batch', paths) // [{ path, exists }]
    const existsByPath = new Map(res.map(x => [x.path, !!x.exists]))
    return paths.map(p => ({ path: p, exists: !!existsByPath.get(p) }))
  } catch {
    return paths.map(p => ({ path: p, exists: false }))
  }
}

function onRowSelect(row) {
  currentPath.value = row?.path || ''
}

function removeAt(i) {
  workingLibraries.value = (workingLibraries.value || []).filter((_, idx) => idx !== i)
}

async function resetWorkingLibraries() {
  const paths = [...(props.setting.libraries || [])]
  workingLibraries.value = await checkLibraryFoldersMissing(paths)
}

const addLibraries = () => emit('add-libraries')
const saveLibraries = () => emit('save-libraries', workingLibraries.value)
const openInOS = () => emit('open-in-os', currentPath.value)

onMounted(() => {
  resetWorkingLibraries()
})

defineExpose({
  resetWorkingLibraries
})
</script>

<style lang="stylus">
// library tab
.libpath {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: bottom;
  white-space: nowrap;
}

.lib-line {
  display: flex;
  align-items: center;
  justify-content: space-between; /* label left, buttons right */
}

/* Button group spacing */
.el-form-item.lib-line {
  padding: 0;
  width: 100%;
}

.el-table .col-right .cell {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px; /* nice spacing if multiple items appear */
}

.el-table th.col-right > .cell {
  justify-content: center
}

/* Wrap long segments and paths nicely */
.el-table .col-path .libpath {
  display: inline;
  white-space: normal;
  word-break: break-word; /* fallback */
  overflow-wrap: anywhere; /* modern browsers */
  line-height: 1.2;
}

/* Optional: prevent the right-fixed columns from shrinking the path */
.el-table .col-path {
  min-width: 240px; /* adjust as needed */
}

.el-table .col-path .cell {
  display: block; /* break out of flex so text can wrap */
  white-space: normal; /* allow line breaks */
  overflow: visible;
}

/* Thicker left divider on the index column (header + body) */
.el-table th.col-index.el-table__cell,
.el-table td.col-index.el-table__cell {
  border-left-width: 5px; /* make it broader */
  border-left-style: solid;
  border-left-color: var(--el-border-color);
  /* optional: extra left padding to match the Actions side spacing */
  padding-left: 3px;
}
</style>