<script setup lang="ts">
import type { ColumnType, TableType } from 'nocodb-sdk'
import { isSystemColumn } from 'nocodb-sdk'

interface Props {
  recordId: string
  tableId: string
}

const props = withDefaults(defineProps<Props>(), {})

const { $api } = useNuxtApp()

const { getMeta } = useMetas()

const { activeProjectId } = storeToRefs(useBases())

const citationMap = inject<ComputedRef<Map<string, number>>>(
  'ChatCitationMap',
  computed(() => new Map()),
)

const citationNumber = computed(() => {
  const key = `${props.tableId}:${props.recordId}`
  return citationMap.value.get(key) || 0
})

const openCitationRecord =
  inject<(tableId: string, recordId: string, recordData?: Record<string, any>) => void>('OpenCitationRecord')

const isLoadingPreview = ref(false)

const previewError = ref<string | null>(null)

const tableMeta = ref<TableType | null>(null)

const recordData = ref<Record<string, any> | null>(null)

const hasFetched = ref(false)

const displayColumn = computed(() => {
  if (!tableMeta.value?.columns) return null
  return (tableMeta.value.columns as ColumnType[]).find((c) => c.pv) || null
})

const displayValue = computed(() => {
  if (!displayColumn.value?.title || !recordData.value) return null
  return recordData.value[displayColumn.value.title] || null
})

const previewColumns = computed(() => {
  if (!tableMeta.value?.columns || !recordData.value) return []
  return (tableMeta.value.columns as ColumnType[])
    .filter((c) => {
      if (isSystemColumn(c)) return false
      if (c.pv) return false
      if (c.uidt === 'ID' || c.uidt === 'ForeignKey') return false
      return recordData.value![c.title!] != null && recordData.value![c.title!] !== ''
    })
    .slice(0, 3)
})

async function fetchPreview() {
  if (hasFetched.value || !activeProjectId.value) return

  isLoadingPreview.value = true
  previewError.value = null
  hasFetched.value = true

  try {
    const meta = (await getMeta(activeProjectId.value, props.tableId)) as TableType
    if (!meta) {
      previewError.value = 'Table not available'
      return
    }
    tableMeta.value = meta

    const record = await $api.dbTableRow.read('noco', meta.base_id || '', props.tableId, props.recordId)
    if (!record) {
      previewError.value = 'Record not available'
      return
    }
    recordData.value = record as Record<string, any>
  } catch {
    previewError.value = 'Record not available'
  } finally {
    isLoadingPreview.value = false
  }
}

const { $e } = useNuxtApp()

function handleDropdownChange(visible: boolean) {
  if (visible && !hasFetched.value) {
    $e('c:chat:citation:hover')
    fetchPreview()
  }
}

function handleClick() {
  if (previewError.value) return
  $e('c:chat:citation:click')
  openCitationRecord?.(props.tableId, props.recordId, recordData.value || undefined)
}
</script>

<template>
  <NcDropdown
    :trigger="['hover']"
    placement="top"
    overlay-class-name="nc-citation-dropdown"
    @update:visible="handleDropdownChange"
  >
    <span class="nc-citation-badge" @click.stop="handleClick">
      {{ citationNumber }}
    </span>

    <template #overlay>
      <div class="nc-citation-preview min-w-[120px] max-w-[320px] p-2.5 cursor-pointer" @click="handleClick">
        <div v-if="isLoadingPreview" class="flex items-center gap-1.5 py-0.5">
          <GeneralLoader size="small" />
          <span class="text-captionSm text-nc-content-gray-subtle">Loading...</span>
        </div>
        <div v-else-if="previewError" class="text-captionSm text-nc-content-gray-subtle py-0.5">
          {{ previewError }}
        </div>
        <template v-else-if="recordData">
          <div v-if="displayValue" class="font-semibold text-bodyDefaultSm text-nc-content-gray truncate">
            <LazySmartsheetPlainCell :model-value="displayValue" :column="displayColumn!" :meta="tableMeta!" />
          </div>

          <table v-if="previewColumns.length" class="nc-citation-table mt-1.5">
            <thead>
              <tr>
                <th v-for="col in previewColumns" :key="col.id">{{ col.title }}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td v-for="col in previewColumns" :key="col.id">
                  <LazySmartsheetPlainCell :model-value="recordData[col.title!]" :column="col" :meta="tableMeta!" />
                </td>
              </tr>
            </tbody>
          </table>
        </template>
      </div>
    </template>
  </NcDropdown>
</template>

<style lang="scss" scoped>
.nc-citation-badge {
  @apply inline-flex items-center justify-center
    min-w-4 h-4 px-1 rounded
    bg-nc-bg-gray-light text-nc-content-gray-subtle
    cursor-pointer border-1 border-nc-border-gray-medium
    transition-colors duration-150
    align-super;
  font-size: 10px;
  line-height: 1;
  margin-top: -2px;

  &:hover {
    @apply bg-nc-bg-gray-medium text-nc-content-gray;
  }
}
</style>

<style lang="scss">
.nc-citation-dropdown {
  .nc-citation-table {
    border-collapse: collapse;
    border-spacing: 0;

    th {
      @apply text-captionXs text-nc-content-gray-subtle font-medium pb-0.5 pr-4 last:pr-0 text-left whitespace-nowrap;
    }

    td {
      @apply text-captionSm text-nc-content-gray pr-4 last:pr-0 truncate;
      max-width: 150px;
    }
  }
}
</style>
