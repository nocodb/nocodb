<script lang="ts" setup>
// todo: Remove this "Provider" component and use the "EditOrAdd" component directly
import type { ColumnReqType, ColumnType } from 'nocodb-sdk'

interface Props {
  column?: ColumnType
  columnPosition?: Pick<ColumnReqType, 'column_order'>
  preload?: Partial<ColumnType>
  tableExplorerColumns?: ColumnType[]
  fromTableExplorer?: boolean
  isColumnValid?: (value: Partial<ColumnType>) => boolean
}

const props = defineProps<Props>()

const emit = defineEmits(['submit', 'cancel', 'mounted'])

const meta = inject(MetaInj, ref())

const { column, preload, tableExplorerColumns, fromTableExplorer, isColumnValid } = toRefs(props)

useProvideColumnCreateStore(meta, column, tableExplorerColumns, fromTableExplorer, isColumnValid)

const { isWebhookCreateModalOpen } = useColumnCreateStoreOrThrow()

const isWebhookModalOpen = () => {
  return isWebhookCreateModalOpen.value
}

defineExpose({
  isWebhookModalOpen,
})
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
