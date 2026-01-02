<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'

interface Props {
  relationColumn: ColumnType
  readonly?: boolean
}

const props = defineProps<Props>()

// Get the original rollup column from the parent context
const originalColumn = inject(ColumnInj)!

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

// Override readonly state if needed
const originalReadonly = inject(ReadonlyInj, ref(false))
provide(
  ReadonlyInj,
  computed(() => props.readonly ?? originalReadonly.value),
)
</script>

<template>
  <!-- Render Links component with proper context -->
  <VirtualCellLinks />
</template>
