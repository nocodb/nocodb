<script setup lang="ts">
import type { ColumnType, TableType, ViewType } from 'nocodb-sdk'
import { UITypes, isSystemColumn, isVirtualCol } from 'nocodb-sdk'

interface Props {
  tableId: string
  recordIds: string[] | string
  fields?: string[] | string
}

const props = withDefaults(defineProps<Props>(), {
  fields: undefined,
})

const { $api, $e } = useNuxtApp()

const { ncNavigateTo } = useGlobal()

const { isFullScreen } = useChatPanel()

const { open: openExpandedForm } = useExpandedFormDetached()

const { getMeta } = useMetas()

const workspaceStore = useWorkspace()

const { activeWorkspaceId } = storeToRefs(workspaceStore)

const basesStore = useBases()

const { activeProjectId } = storeToRefs(basesStore)

const { base } = storeToRefs(useBase())

const isLoading = ref(true)

const error = ref<string | null>(null)

const tableMeta = ref<TableType | undefined>()

const displayColumn = ref<ColumnType | undefined>()

const dataColumns = ref<ColumnType[]>([])

const rowObjects = ref<Row[]>([])

const totalCount = ref(0)

const hoveredRowIndex = ref<number | null>(null)

const isScrolled = ref(false)

function onGridScroll(e: Event) {
  isScrolled.value = (e.target as HTMLElement).scrollLeft > 0
}

const metaRef = computed(() => tableMeta.value)

const activeSource = computed(() => {
  return tableMeta.value?.source_id && base.value?.sources?.find((s) => s.id === tableMeta.value?.source_id)
})

provide(MetaInj, metaRef)
provide(ActiveSourceInj, activeSource)
provide(IsGridInj, ref(true))
provide(IsFormInj, ref(false))
provide(IsGalleryInj, ref(false))
provide(IsCalendarInj, ref(false))
provide(IsPublicInj, ref(false))
provide(IsExpandedFormOpenInj, ref(false))
const reloadViewDataHook = createEventHook()
const reloadRowDataHook = createEventHook()

provide(ReloadViewDataHookInj, reloadViewDataHook)
provide(ReloadRowDataHookInj, reloadRowDataHook)

reloadViewDataHook.on(fetchData)
reloadRowDataHook.on(fetchData)
provide(RowHeightInj, ref(1 as const))

const undefinedView = ref(undefined as unknown as ViewType)
useProvideSmartsheetLtarHelpers(metaRef)
useProvideSmartsheetStore(undefinedView, metaRef)
useProvideKanbanViewStore(metaRef, undefinedView)
useProvideViewColumns(undefinedView, metaRef)

const parsedRecordIds = computed(() => {
  if (Array.isArray(props.recordIds)) return props.recordIds
  try {
    return JSON.parse(props.recordIds as string) as string[]
  } catch {
    return []
  }
})

const parsedFields = computed(() => {
  if (!props.fields) return undefined
  if (Array.isArray(props.fields)) return props.fields
  try {
    return JSON.parse(props.fields as string) as string[]
  } catch {
    return undefined
  }
})

const SYSTEM_FIELD_TYPES = new Set([UITypes.CreatedTime, UITypes.LastModifiedTime, UITypes.CreatedBy, UITypes.LastModifiedBy])

const tableName = computed(() => tableMeta.value?.title || 'Table')

const isTruncated = computed(() => totalCount.value > rowObjects.value.length)

const colMeta = computed(() => {
  const all = [displayColumn.value, ...dataColumns.value].filter(Boolean) as ColumnType[]
  return all.map((col) => ({ isVirtualCol: isVirtualCol(col) }))
})

function getRowId(row: Row): string | null {
  if (!tableMeta.value?.columns) return null
  return extractPkFromRow(row.row, tableMeta.value.columns as ColumnType[])
}

function handleRowClick(row: Row) {
  if (!tableMeta.value) return
  $e('c:chat:grid:row-expand')

  const rowId = getRowId(row)
  if (!rowId) return

  openExpandedForm({
    isOpen: true,
    row: { row: { ...row.row }, oldRow: { ...row.row }, rowMeta: {} },
    meta: tableMeta.value,
    loadRow: true,
    rowId,
    useMetaFields: true,
  })
}

function navigateToTable() {
  if (!tableMeta.value) return
  $e('c:chat:grid:open-table')

  if (isFullScreen.value) isFullScreen.value = false

  ncNavigateTo({
    workspaceId: activeWorkspaceId.value,
    baseId: tableMeta.value.base_id || '',
    tableId: props.tableId,
  })
}

const allColumns = computed(() => [displayColumn.value, ...dataColumns.value].filter(Boolean) as ColumnType[])

async function copyToClipboard() {
  if (!tableMeta.value || !rowObjects.value.length) return
  $e('c:chat:grid:copy')

  const { html, text } = serializeRange(rowObjects.value, allColumns.value, {
    isPg: () => false,
    isMysql: () => false,
    meta: tableMeta.value!,
  })

  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      }),
    ])
  } catch {
    await navigator.clipboard.writeText(text)
  }

  message.success('Copied to clipboard')
}

function downloadAsCsv() {
  if (!tableMeta.value || !rowObjects.value.length) return
  $e('c:chat:grid:download-csv')

  const { text } = serializeRange(rowObjects.value, allColumns.value, {
    isPg: () => false,
    isMysql: () => false,
    meta: tableMeta.value!,
  })

  const csvRows = text.split('\n').map((line) =>
    line
      .split('\t')
      .map((field) => {
        if (field.includes(',') || field.includes('"') || field.includes('\n')) {
          return `"${field.replace(/"/g, '""')}"`
        }
        return field
      })
      .join(','),
  )
  const csv = csvRows.join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${tableName.value}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

async function fetchData() {
  isLoading.value = true
  error.value = null

  try {
    if (!activeProjectId.value) {
      error.value = 'No active base'
      return
    }

    let meta: TableType | null = null
    try {
      meta = (await getMeta(activeProjectId.value, props.tableId)) as TableType
    } catch {
      // table deleted or inaccessible
    }

    if (!meta?.columns) {
      error.value = 'Table is no longer available'
      return
    }

    tableMeta.value = meta

    const allColumns = meta.columns as ColumnType[]

    const pvField = allColumns.find((c) => c.pv)

    let candidates = allColumns.filter(
      (c) =>
        !isSystemColumn(c) &&
        c.uidt !== UITypes.ID &&
        c.uidt !== UITypes.ForeignKey &&
        !SYSTEM_FIELD_TYPES.has(c.uidt as UITypes) &&
        c.id !== pvField?.id,
    )

    if (parsedFields.value?.length) {
      const fieldSet = new Set(parsedFields.value)
      candidates = candidates.filter((c) => fieldSet.has(c.title!))
    }

    displayColumn.value = pvField
    dataColumns.value = candidates
    totalCount.value = parsedRecordIds.value.length

    if (parsedRecordIds.value.length > 0) {
      const idField = allColumns.find((c) => c.pk)?.title || 'Id'
      const idList = parsedRecordIds.value.join(',')

      const response = await $api.dbTableRow.list('noco', meta.base_id || '', props.tableId, {
        where: `(${idField},in,${idList})`,
        limit: Math.min(parsedRecordIds.value.length, 25),
      })

      const list: Record<string, any>[] = (response as any)?.list || []

      rowObjects.value = list.map((r, i) => ({
        row: r,
        oldRow: { ...r },
        rowMeta: { rowIndex: i },
      }))
    }
  } catch (e: any) {
    error.value = e?.message || 'Failed to load records'
  } finally {
    isLoading.value = false
  }
}

onMounted(fetchData)
</script>

<template>
  <div class="nc-chat-embedded-grid rounded-lg overflow-hidden">
    <div
      class="flex items-center justify-between px-3 py-1.5 bg-nc-bg-gray-extralight border-1 border-nc-border-gray-medium rounded-t-lg"
    >
      <div class="flex items-center gap-1.5 cursor-pointer hover:underline" @click="navigateToTable">
        <GeneralIcon icon="table" class="w-3.5 h-3.5 text-nc-content-gray-subtle" />
        <span class="text-captionSm font-semibold text-nc-content-gray">{{ tableName }}</span>
      </div>

      <NcDropdown v-if="!isLoading && !error && rowObjects.length" placement="bottomRight">
        <NcButton size="xxsmall" type="text" class="!h-5.5 !w-5.5">
          <GeneralIcon icon="threeDotVertical" class="w-3.5 h-3.5 text-nc-content-gray-subtle" />
        </NcButton>

        <template #overlay>
          <NcMenu variant="small">
            <NcMenuItem @click="copyToClipboard">
              <GeneralIcon icon="copy" class="!w-3.5 !h-3.5" />
              Copy to clipboard
            </NcMenuItem>
            <NcMenuItem @click="downloadAsCsv">
              <GeneralIcon icon="download" class="!w-3.5 !h-3.5" />
              Download as CSV
            </NcMenuItem>
          </NcMenu>
        </template>
      </NcDropdown>
    </div>
    <div v-if="isLoading" class="px-0 border-x-1 border-nc-border-gray-medium">
      <div
        v-for="i in 4"
        :key="i"
        class="flex items-center gap-3 px-3 py-2.5 border-b-1 border-nc-border-gray-light last:border-b-0"
      >
        <div class="w-5 h-3 rounded bg-nc-bg-gray-light animate-pulse" />
        <div class="flex-1 h-3 rounded bg-nc-bg-gray-light animate-pulse" />
        <div class="w-20 h-3 rounded bg-nc-bg-gray-light animate-pulse" />
        <div class="w-16 h-3 rounded bg-nc-bg-gray-light animate-pulse" />
      </div>
    </div>
    <div
      v-else-if="error"
      class="flex flex-col items-center gap-2 px-4 py-6 border-x-1 border-b-1 border-nc-border-gray-medium rounded-b-lg"
    >
      <GeneralIcon icon="alertTriangle" class="w-5 h-5 text-nc-content-red" />
      <span class="text-captionSm text-nc-content-red">{{ error }}</span>
      <NcButton v-if="error !== 'Table is no longer available'" size="xs" type="text" @click="fetchData">
        <div class="flex items-center gap-1">
          <GeneralIcon icon="refresh" class="w-3.5 h-3.5" />
          <span>Retry</span>
        </div>
      </NcButton>
    </div>
    <div
      v-else-if="(displayColumn || dataColumns.length) && rowObjects.length"
      class="nc-embedded-grid-scroll overflow-auto nc-scrollbar-thin max-h-[300px] border-x-1 border-nc-border-gray-medium"
      :class="{ 'is-scrolled': isScrolled }"
      @scroll="onGridScroll"
    >
      <table class="w-full text-captionSm">
        <thead class="sticky top-0 z-3">
          <tr class="bg-nc-bg-gray-extralight">
            <th class="nc-grid-th sticky left-0 z-4 bg-nc-bg-gray-extralight w-9 min-w-9">#</th>
            <th
              v-if="displayColumn"
              class="nc-grid-th nc-grid-pv-col sticky z-4 bg-nc-bg-gray-extralight border-l-1 border-nc-border-gray-light"
            >
              <div class="flex items-center gap-1.5">
                <component
                  :is="getUIDTIcon(displayColumn.uidt || UITypes.SingleLineText)"
                  class="w-3.5 h-3.5 text-nc-content-gray-subtle flex-none"
                />
                <NcTooltip show-on-truncate-only class="truncate">
                  <template #title>{{ displayColumn.title }}</template>
                  {{ displayColumn.title }}
                </NcTooltip>
              </div>
            </th>
            <th
              v-for="col in dataColumns"
              :key="col.id"
              class="nc-grid-th nc-grid-data-col border-l-1 border-nc-border-gray-light"
            >
              <div class="flex items-center gap-1.5">
                <component
                  :is="getUIDTIcon(col.uidt || UITypes.SingleLineText)"
                  class="w-3.5 h-3.5 text-nc-content-gray-subtle flex-none"
                />
                <NcTooltip show-on-truncate-only class="truncate">
                  <template #title>{{ col.title }}</template>
                  {{ col.title }}
                </NcTooltip>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <LazySmartsheetRow v-for="(row, ri) in rowObjects" :key="ri" :row="row">
            <template #default="{ state }">
              <tr
                class="cursor-pointer transition-colors"
                :class="ri % 2 === 0 ? 'bg-white dark:bg-nc-bg-default' : 'bg-nc-bg-gray-extralight'"
                @mouseenter="hoveredRowIndex = ri"
                @mouseleave="hoveredRowIndex = null"
                @click="handleRowClick(row)"
              >
                <td
                  class="nc-grid-td sticky left-0 z-1 w-9 min-w-9"
                  :class="ri % 2 === 0 ? 'bg-white dark:bg-nc-bg-default' : 'bg-nc-bg-gray-extralight'"
                >
                  <div class="flex items-center justify-center">
                    <GeneralIcon v-if="hoveredRowIndex === ri" icon="ncMaximize" class="w-3.5 h-3.5 text-nc-content-brand" />
                    <span v-else class="text-nc-content-gray-muted">{{ ri + 1 }}</span>
                  </div>
                </td>
                <td
                  v-if="displayColumn"
                  class="nc-grid-td nc-grid-pv-col sticky z-1 border-l-1 border-nc-border-gray-light font-medium"
                  :class="ri % 2 === 0 ? 'bg-white dark:bg-nc-bg-default' : 'bg-nc-bg-gray-extralight'"
                >
                  <LazySmartsheetVirtualCell
                    v-if="isVirtualCol(displayColumn)"
                    v-model="row.row[displayColumn.title!]"
                    :column="displayColumn"
                    :row="row"
                    read-only
                  />
                  <LazySmartsheetCell
                    v-else
                    v-model="row.row[displayColumn.title!]"
                    :edit-enabled="false"
                    :column="displayColumn"
                    :row-index="ri"
                    read-only
                  />
                </td>
                <td
                  v-for="(col, ci) in dataColumns"
                  :key="col.id"
                  class="nc-grid-td nc-grid-data-col border-l-1 border-nc-border-gray-light"
                >
                  <LazySmartsheetVirtualCell
                    v-if="colMeta[ci + 1]?.isVirtualCol"
                    v-model="row.row[col.title!]"
                    :column="col"
                    :row="row"
                    read-only
                  />
                  <LazySmartsheetCell
                    v-else
                    v-model="row.row[col.title!]"
                    :edit-enabled="false"
                    :column="col"
                    :row-index="ri"
                    read-only
                  />
                </td>
              </tr>
            </template>
          </LazySmartsheetRow>
          <!-- Spacer rows -->
          <tr v-for="i in 3" :key="`spacer-${i}`" class="nc-grid-spacer-row">
            <td :colspan="1 + (displayColumn ? 1 : 0) + dataColumns.length">&nbsp;</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Empty state -->
    <div
      v-else-if="!isLoading && !error"
      class="flex flex-col items-center gap-2 px-4 py-6 border-x-1 border-b-1 border-nc-border-gray-medium rounded-b-lg"
    >
      <GeneralIcon icon="ncSearch" class="w-6 h-6 text-nc-content-gray-light" />
      <span class="text-captionSm text-nc-content-gray-subtle">No matching records found</span>
    </div>

    <!-- Footer -->
    <div
      v-if="!isLoading && !error && rowObjects.length"
      class="flex items-center justify-between px-3 py-1 border-1 border-nc-border-gray-medium bg-nc-bg-gray-extralight rounded-b-lg"
    >
      <span class="text-captionXs text-nc-content-gray-muted">
        <template v-if="isTruncated"> Showing {{ rowObjects.length }} of {{ totalCount }} records </template>
        <template v-else> {{ rowObjects.length }} {{ rowObjects.length === 1 ? 'record' : 'records' }} </template>
      </span>
      <span
        class="text-captionXs text-nc-content-brand cursor-pointer hover:underline flex items-center gap-0.5"
        @click="navigateToTable"
      >
        View all in table
        <GeneralIcon icon="arrowRight" class="w-3 h-3" />
      </span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-chat-embedded-grid {
  table {
    border-collapse: collapse;
    border-spacing: 0;
  }

  tr:last-child td {
    @apply border-b-0;
  }

  thead th {
    @apply select-none;
  }

  tbody tr:hover:not(.nc-grid-spacer-row) td {
    @apply !bg-nc-bg-gray-light;
  }

  .nc-grid-spacer-row td {
    @apply !border-b-0;
    height: 32px;
  }
}

// ── Shared header / cell base ─────────────────────────────
.nc-grid-th {
  @apply px-2.5 py-1.5 text-left font-medium text-nc-content-gray-subtle
    border-b-1 border-nc-border-gray-light whitespace-nowrap;
}

.nc-grid-td {
  @apply px-2 py-0 border-b-1 border-nc-border-gray-light;

  // Match smartsheet cell sizing
  :deep(.cell) {
    @apply !min-h-0;
  }
}

// ── PV column — fixed 200px, sticky after row-number (36px) ──
.nc-grid-pv-col {
  min-width: 200px;
  max-width: 200px;
  width: 200px;
  left: 36px;
}

// ── Data columns — standard width ─────────────────────────
.nc-grid-data-col {
  min-width: 150px;
  max-width: 220px;
  width: 180px;
}

// ── Scroll shadow on sticky columns ──────────────────────
.nc-embedded-grid-scroll.is-scrolled {
  .nc-grid-pv-col::after {
    content: '';
    position: absolute;
    top: 0;
    right: -6px;
    bottom: 0;
    width: 6px;
    background: linear-gradient(to right, rgba(0, 0, 0, 0.08), transparent);
    pointer-events: none;
  }
}

.nc-embedded-grid-scroll {
  scrollbar-gutter: stable;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

.animate-pulse {
  animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style>
