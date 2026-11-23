<script setup lang="ts">
const viewPrint = useViewPrint()

const view = inject(ActiveViewInj, ref())

const fields = inject(FieldsInj, ref([]))

const { sorts, nestedFilters, xWhere } = useSmartsheetStoreOrThrow()

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

const recordLimit = VIEW_PRINT_RECORD_LIMIT

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

function onPrint(settings: PrintSettings, range: PrintRange) {
  viewPrint?.print(settings, range, currentQuery())
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
      :record-limit="recordLimit"
      @print="onPrint"
    />

    <SmartsheetPrintTable
      v-if="viewPrint.printState.value"
      :title="view?.title"
      :columns="printColumns"
      :rows="viewPrint.printState.value.rows"
      :total-rows="viewPrint.printState.value.totalRows"
      :range-start="viewPrint.printState.value.rangeStart"
      :settings="viewPrint.printState.value.settings"
      :column-widths="columnWidths"
      :group-columns="viewPrint.printState.value.groupColumns"
    />
  </template>
</template>
