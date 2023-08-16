<script lang="ts" setup>
// todo: Remove this "Provider" component and use the "EditOrAdd" component directly
import type { ColumnReqType, ColumnType } from 'nocodb-sdk'
import { MetaInj, inject, ref, toRef, useProvideColumnCreateStore } from '#imports'

interface Props {
  column?: ColumnType
  columnPosition?: Pick<ColumnReqType, 'column_order'>
  preload?: Partial<ColumnType>
  tableExplorerColumns?: ColumnType[]
  fromTableExplorer?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits(['submit', 'cancel', 'mounted'])

const meta = inject(MetaInj, ref())

const column = toRef(props, 'column')

const preload = toRef(props, 'preload')

const tableExplorerColumns = toRef(props, 'tableExplorerColumns')

useProvideColumnCreateStore(meta, column, tableExplorerColumns)
</script>

<template>
  <SmartsheetColumnEditOrAdd
    :preload="preload"
    :column-position="props.columnPosition"
    :from-table-explorer="props.fromTableExplorer || false"
    @submit="emit('submit')"
    @cancel="emit('cancel')"
    @mounted="emit('mounted')"
  />
</template>
