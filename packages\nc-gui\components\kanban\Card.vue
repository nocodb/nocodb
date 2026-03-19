<script lang="ts" setup>
import type { AttachmentType, ColumnType } from 'nocodb-sdk'
import type { Row as RowType } from '#imports'
import {
  IsPublicInj,
  ReloadViewDataHookInj,
  computed,
  inject,
  ref,
  useKanbanViewStoreOrThrow,
  useSmartsheetRowStoreOrThrow,
  useViewColumnsOrThrow,
} from '#imports'

const props = defineProps<{
  row: RowType
  rowIndex: number
}>()

const emit = defineEmits(['expandRow', 'updateRowProperty'])

const { row, rowIndex } = toRefs(props)

const expandRow = inject('expandRow', (_row: RowType) => {})

const { isUIAllowed } = useRoles()

const { isMobileMode } = useGlobal()

const isPublic = inject(IsPublicInj, ref(false))

const { fields, coverImageField, displayField } = useViewColumnsOrThrow()

const {
  kanbanMetaData,
  updateOrSaveRow,
  kanbanViewCoverImageColumnId,
} = useKanbanViewStoreOrThrow()

const compactMode = computed(() => kanbanMetaData.value?.compact_mode ?? false)
</script>
