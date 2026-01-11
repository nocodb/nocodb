<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'

interface Props {
  relationColumn: ColumnType
  readonly?: boolean
}

const props = defineProps<Props>()

// Get the original rollup column from the parent context
const originalColumn = inject(ColumnInj)!

// Get all the original context injections to pass through
const originalReadonly = inject(ReadonlyInj, ref(false))
const originalIsForm = inject(IsFormInj, ref(false))
const originalIsUnderLookup = inject(IsUnderLookupInj, ref(false))
const originalIsExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))
const originalIsCanvasInjected = inject(IsCanvasInjectionInj, false)
const originalClientMousePosition = inject(ClientMousePositionInj)
const originalCanvasCellEventData = inject(CanvasCellEventDataInj, reactive<CanvasCellEventDataInjType>({}))
const originalCellEventHook = inject(CellEventHookInj, null)
const originalActiveCell = inject(ActiveCellInj, ref(false))
const originalRow = inject(RowInj)
const originalReloadRowTrigger = inject(ReloadRowDataHookInj, createEventHook())
const originalCellValue = inject(CellValueInj, ref(0))

// Override the column injection to provide the relation column
// but preserve the rollup column's title and meta for display purposes
provide(
  ColumnInj,
  computed(() => {
    // Use the relation column with its original colOptions (essential for LTAR store)
    // but preserve rollup column's title and meta for display
    const baseColumn = props.relationColumn as ColumnType
    return {
      ...baseColumn,
      title: originalColumn.value?.title || baseColumn?.title,
      meta: Object.assign({}, baseColumn?.meta, originalColumn.value?.meta),
      // Ensure colOptions are preserved for LTAR functionality
      colOptions: baseColumn?.colOptions,
    } as Required<ColumnType>
  }),
)

// Provide all the context injections that Links component expects
provide(
  ReadonlyInj,
  computed(() => props.readonly ?? originalReadonly.value),
)

// Pass through other injections that affect permissions
provide(IsFormInj, originalIsForm)
provide(IsUnderLookupInj, originalIsUnderLookup)
provide(IsExpandedFormOpenInj, originalIsExpandedFormOpen)
provide(IsCanvasInjectionInj, originalIsCanvasInjected)
provide(ClientMousePositionInj, originalClientMousePosition)
provide(CanvasCellEventDataInj, originalCanvasCellEventData)
provide(CellEventHookInj, originalCellEventHook)
provide(ActiveCellInj, originalActiveCell)
provide(RowInj, originalRow)
provide(ReloadRowDataHookInj, originalReloadRowTrigger)
provide(CellValueInj, originalCellValue)
</script>

<template>
  <!-- Render Links component with proper context -->
  <VirtualCellLinks />
</template>
