<script lang="ts" setup>
// todo: Remove this "Provider" component and use the "EditOrAdd" component directly
import type { ColumnReqType, ColumnType } from 'nocodb-sdk'

interface Props {
  column?: ColumnType
  columnPosition?: Pick<ColumnReqType, 'column_order'>
  preload?: Partial<ColumnType>
  tableExplorerColumns?: ColumnType[]
  editDescription?: boolean
  fromTableExplorer?: boolean
  isColumnValid?: (value: Partial<ColumnType>) => boolean
  disableTitleFocus?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits(['submit', 'cancel', 'mounted'])

const meta = inject(MetaInj, ref())

const { column, preload, tableExplorerColumns, fromTableExplorer, isColumnValid, editDescription } = toRefs(props)

useProvideColumnCreateStore(meta, column, tableExplorerColumns, fromTableExplorer, isColumnValid)

const { isWebhookCreateModalOpen, isAiButtonConfigModalOpen } = useColumnCreateStoreOrThrow()

/**
 * Determines whether the root dropdown should remain open.
 *
 * This function prevents the root dropdown from closing when certain modals are open.
 * The current implementation checks if either the Webhook Create Modal or the AI Button Config Modal
 * is active, but developers can extend this logic to include more modals as needed.
 *
 * @returns {boolean} - Returns `true` if any of the specified modals (e.g., Webhook Create Modal, AI Button Config Modal) are open, otherwise `false`.
 */
const shouldKeepModalOpen = (): boolean => {
  return isWebhookCreateModalOpen.value || isAiButtonConfigModalOpen.value
}

defineExpose({
  shouldKeepModalOpen,
})
</script>

<template>
  <SmartsheetColumnEditOrAdd
    :preload="preload"
    :column-position="props.columnPosition"
    :edit-description="editDescription"
    :from-table-explorer="props.fromTableExplorer || false"
    :disable-title-focus="disableTitleFocus"
    @submit="emit('submit', $event)"
    @cancel="emit('cancel')"
    @mounted="emit('mounted')"
  />
</template>
