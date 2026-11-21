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

function onPrint(settings: PrintSettings) {
  viewPrint?.print(settings, {
    sorts: sorts.value,
    nestedFilters: nestedFilters.value,
    where: xWhere.value,
    groupBy: groupBy.value,
  })
}
</script>

<template>
  <template v-if="viewPrint">
    <DlgPrintSettings
      v-if="viewPrint.isSettingsOpen.value"
      v-model:visible="viewPrint.isSettingsOpen.value"
      :storage-key="viewPrint.storageKey.value"
      :loading="viewPrint.isPreparing.value"
      @print="onPrint"
    />

    <SmartsheetPrintTable
      v-if="viewPrint.printState.value"
      :title="view?.title"
      :columns="printColumns"
      :rows="viewPrint.printState.value.rows"
      :total-rows="viewPrint.printState.value.totalRows"
      :settings="viewPrint.printState.value.settings"
      :column-widths="columnWidths"
      :group-columns="viewPrint.printState.value.groupColumns"
    />
  </template>
</template>
