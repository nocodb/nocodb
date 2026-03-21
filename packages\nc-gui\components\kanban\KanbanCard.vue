<script lang="ts" setup>
import type { ColumnType, KanbanType } from 'nocodb-sdk'
import { computed, inject, provide, ref, useGlobal, useKanbanViewStore, useViewColumnsOrThrow } from '#imports'

const props = defineProps<{
  rowIndex: number
  stackIndex: number
  isAdding?: boolean
}>()

const emit = defineEmits(['expand', 'editMode', 'addRecord', 'newRecord'])

const {
  isPublic,
  kanbanMetaData: meta,
  kanbanViewRows: viewRows,
  updateOrSaveRow,
  deleteRow,
} = useKanbanViewStore()

const { isMobileMode } = useGlobal()

const { fields, coverImageField, hiddenFields } = useViewColumnsOrThrow()

const row = computed(() => viewRows.value?.[props.stackIndex]?.[props.rowIndex])

const isCompact = computed(() => !!(meta.value as KanbanType)?.meta?.compact)

const coverImage = computed(() => {
  if (!coverImageField.value || !row.value?.row) return null
  return row.value.row[coverImageField.value]
})

const displayField = computed(() => fields.value?.find((f) => f.pv))
const displayValue = computed(() => {
  if (!displayField.value || !row.value?.row) return ''
  return row.value.row[displayField.value.title]
})
</script>
