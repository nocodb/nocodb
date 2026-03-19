<script lang="ts" setup>
import type { Row as RowType } from '#imports'

const props = defineProps<{
  row: RowType
  rowIndex: number
}>()

const { row, rowIndex } = toRefs(props)

const fields = inject(FieldsInj, ref([]))

const isPublic = inject(IsPublicInj, ref(false))

const { isUIAllowed } = useRoles()

const { isMobileMode } = useGlobal()

const expandRow = inject(ExpandRowInj, (_row: RowType) => {})

const meta = inject(MetaInj, ref())

const { kanbanMetaData, kanbanViewCoverImageColumnId, updateOrSaveRow } = useKanbanViewStoreOrThrow()

const { isNew, syncCount } = useSmartsheetRowStoreOrThrow()

const reloadViewDataHook = inject(ReloadViewDataHookInj)

const isCompactMode = computed(() => !!(kanbanMetaData.value as any)?.compact_mode)

const coverImageColumn = computed(() =>
  meta.value?.columns?.find((col: ColumnType) => col.id === kanbanViewCoverImageColumnId.value),
)

const coverImage = computed(() => {
  if (!coverImageColumn.value?.title) return null
  const attachments = row.value.row[coverImageColumn.value.title]
  if (!attachments || !Array.isArray(attachments) || attachments.length === 0) return null
  return attachments[0]?.signedPath || attachments[0]?.path || null
})

const rowFields = computed(() => {
  if (!fields.value) return []
  return fields.value.filter(
    (f) => f.show && f.id !== kanbanViewCoverImageColumnId.value,
  )
})
</script>
