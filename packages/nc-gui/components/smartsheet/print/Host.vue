<script setup lang="ts">
import { CommonAggregations, type GridType } from 'nocodb-sdk'

const viewPrint = useViewPrint()

const { t } = useI18n()

const { isUIAllowed } = useRoles()

const { metas } = useMetas()

const { isMysql, isPg } = useBase()

const { internalGet } = useInternalBatch()

const view = inject(ActiveViewInj, ref())

const fields = inject(FieldsInj, ref([]))

const { meta, sorts, nestedFilters, xWhere } = useSmartsheetStoreOrThrow()

const { groupBy } = useViewGroupByOrThrow()

const { gridViewCols } = useViewColumnsOrThrow()

// The grid pins the display value first.
const printColumns = computed(() => [...fields.value.filter((c) => c.pv), ...fields.value.filter((c) => !c.pv)])

const columnWidths = computed(() =>
  Object.fromEntries(Object.values(gridViewCols.value).map((col) => [col.fk_column_id, col.width ?? undefined])),
)

// A hidden field comes back with the rows only when it is a saved group field.
const printableGroupBy = computed(() =>
  groupBy.value.filter(
    (g) =>
      fields.value.some((f) => f.id === g.column.id) ||
      Object.values(gridViewCols.value).some((col) => col.fk_column_id === g.column.id && col.group_by),
  ),
)

const useSvgRenderer = isSvgPrintRenderer()

let resolveSvgReady: (() => void) | undefined

function waitForRender() {
  if (!useSvgRenderer) return Promise.resolve()
  return new Promise<void>((resolve) => {
    resolveSvgReady = resolve
  })
}

const rowHeight = computed(() => (view.value?.view as GridType | undefined)?.row_height ?? null)

function cellsPerRecord(settings: PrintSettings) {
  return countPrintCellsPerRecord(printColumns.value, columnWidths.value, settings)
}

const recordCount = ref<number | null>(null)

// Only the latest open's count applies.
let countSeq = 0

function currentQuery() {
  return {
    sorts: sorts.value,
    nestedFilters: nestedFilters.value,
    where: xWhere.value,
    groupBy: printableGroupBy.value,
  }
}

/** The grid footer's summaries, for the whole view. */
async function loadSummary(): Promise<PrintSummary> {
  const table = meta.value
  const requested = printColumns.value
    .map((column) => ({ column, type: gridViewCols.value[column.id!]?.aggregation }))
    .filter(({ type }) => type && type !== CommonAggregations.None)
  if (!requested.length || !table?.base_id || !view.value?.id) return {}

  const data = await internalGet(table.fk_workspace_id!, table.base_id, {
    operation: 'dataAggregate',
    tableId: table.id,
    viewId: view.value.id,
    baseId: table.base_id,
    where: xWhere.value,
    ...(isUIAllowed('filterSync') ? {} : { filterArrJson: JSON.stringify(nestedFilters.value) }),
    aggregation: requested.map(({ column, type }) => ({ field: column.id!, type: type! })),
  })

  return Object.fromEntries(
    requested.map(({ column, type }) => [
      column.id!,
      {
        label: t(`aggregation.${type}`).replace('Percent ', ''),
        value: String(
          getFormattedAggrationValue(type!, data?.[column.title!], column, [], {
            meta: table,
            metas: metas.value,
            isMysql,
            isPg,
            col: column,
          }) ?? '',
        ),
      },
    ]),
  )
}

function onPrint(settings: PrintSettings, range: PrintRange) {
  viewPrint?.print(settings, range, currentQuery(), loadSummary, waitForRender)
}

watch(
  () => viewPrint?.isSettingsOpen.value,
  async (isOpen) => {
    const seq = ++countSeq
    if (!isOpen || !viewPrint) return

    recordCount.value = null
    try {
      const count = await viewPrint.countRecords(currentQuery())
      if (seq === countSeq) recordCount.value = count
    } catch (e: any) {
      if (seq !== countSeq) return
      viewPrint.isSettingsOpen.value = false
      message.error(await extractSdkResponseErrorMsg(e))
    }
  },
  { immediate: true },
)
</script>

<template>
  <template v-if="viewPrint">
    <DlgPrintSettings
      v-if="viewPrint.isSettingsOpen.value"
      v-model:visible="viewPrint.isSettingsOpen.value"
      :storage-key="viewPrint.storageKey.value"
      :loading="viewPrint.isPreparing.value"
      :record-count="recordCount"
      :cells-per-record="cellsPerRecord"
      @print="onPrint"
    />

    <SmartsheetPrintSvgPages
      v-if="viewPrint.printState.value && useSvgRenderer"
      :title="view?.title"
      :columns="printColumns"
      :rows="viewPrint.printState.value.rows"
      :total-rows="viewPrint.printState.value.totalRows"
      :range-start="viewPrint.printState.value.rangeStart"
      :settings="viewPrint.printState.value.settings"
      :column-widths="columnWidths"
      :row-height="rowHeight"
      :group-columns="viewPrint.printState.value.groupColumns"
      :summary="viewPrint.printState.value.summary"
      @ready="resolveSvgReady?.()"
    />
    <SmartsheetPrintTable
      v-else-if="viewPrint.printState.value"
      :title="view?.title"
      :columns="printColumns"
      :rows="viewPrint.printState.value.rows"
      :total-rows="viewPrint.printState.value.totalRows"
      :range-start="viewPrint.printState.value.rangeStart"
      :settings="viewPrint.printState.value.settings"
      :column-widths="columnWidths"
      :group-columns="viewPrint.printState.value.groupColumns"
      :row-height="rowHeight"
      :summary="viewPrint.printState.value.summary"
    />
  </template>
</template>
