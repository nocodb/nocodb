import { computed, reactive, ref } from '#imports'
import type {
  AttachmentType,
  ColumnType,
  FilterType,
  KanbanType,
  LinkToAnotherRecordType,
  MapType,
  SortType,
  TableType,
  ViewType,
} from 'nocodb-sdk'
import { UITypes, ViewTypes, isSystemColumn, isVirtualCol } from 'nocodb-sdk'
import { useFieldQuery } from './useFieldQuery'
import { useSharedView } from './useSharedView'
import { createEventHook, useEventBus } from '@vueuse/core'

const GROUP_BY_SUFFIX = '__nc_gb_val'

interface Row {
  row: Record<string, any>
  oldRow: Record<string, any>
  rowMeta: {
    new?: boolean
    selected?: boolean
    rowIndex?: number
    commentCount?: number
    attachmentCount?: number
    [key: string]: any
  }
}

interface KanbanViewMetaType {
  fk_grp_col_id?: string
  field_ids?: string[]
  compact?: boolean
  cover_image_object_fit?: string
}

interface KanbanState {
  kanbanMetaData: KanbanType & { meta?: KanbanViewMetaType }
  kanbanViewRows: Map<string | null, Row[]>
  countByStack: Map<string | null, number>
  groupingField: ColumnType | undefined
  groupingFieldColOptions: Array<{ id: string; title: string; order: number; color: string }>
  groupingFieldColumn: ColumnType | undefined
  activeStack: string | null
  loadMoreLastId: Record<string, string>
  isKanbanDataLoading: boolean
  isLoading: boolean
  noOfRowsLoaded: number
  totalRowsCount: number
}

export const useKanbanViewStore = createSharedComposable(() => {
  const { $api, $e } = useNuxtApp()
  const { t } = useI18n()
  const router = useRouter()
  const route = router.currentRoute

  const { meta: metaValue, view: activeView } = useSmartsheetStoreOrThrow()
  const { metas, getMeta } = useMetas()
  const { addUndo, defineViewScope } = useUndoRedo()
  const { isPublic, sharedView } = useSharedView()

  const kanbanMetaData = ref<KanbanType & { meta?: KanbanViewMetaType }>({})
  const kanbanViewRows = ref<Map<string | null, Row[]>>(new Map())
  const countByStack = ref<Map<string | null, number>>(new Map())
  const groupingField = ref<ColumnType>()
  const groupingFieldColOptions = ref<Array<{ id: string; title: string; order: number; color: string }>>([])
  const groupingFieldColumn = ref<ColumnType>()
  const loadMoreLastId = ref<Record<string, string>>({})
  const isKanbanDataLoading = ref(false)
  const isLoading = ref(false)
  const activeStack = ref<string | null>(null)
  const noOfRowsLoaded = ref(0)
  const totalRowsCount = ref(0)

  // Compact mode
  const isCompact = computed(() => !!(kanbanMetaData.value?.meta?.compact))

  const updateCompact = async (val: boolean) => {
    const updatedMeta = {
      ...kanbanMetaData.value?.meta,
      compact: val,
    }
    await updateKanbanMeta({ meta: updatedMeta })
  }

  const updateKanbanMeta = async (updateObj: Partial<KanbanType & { meta?: KanbanViewMetaType }>) => {
    if (!activeView.value?.id || isPublic.value) return

    await $api.dbView.kanbanUpdate(activeView.value.id, updateObj)
    kanbanMetaData.value = {
      ...kanbanMetaData.value,
      ...updateObj,
      meta: {
        ...kanbanMetaData.value.meta,
        ...updateObj.meta,
      },
    }
  }

  const loadKanbanMeta = async () => {
    if (!activeView.value?.id) return

    const data = await $api.dbView.kanbanRead(activeView.value.id)
    kanbanMetaData.value = data
  }

  return {
    kanbanMetaData,
    kanbanViewRows,
    countByStack,
    groupingField,
    groupingFieldColOptions,
    groupingFieldColumn,
    loadMoreLastId,
    isKanbanDataLoading,
    isLoading,
    activeStack,
    noOfRowsLoaded,
    totalRowsCount,
    isCompact,
    updateCompact,
    updateKanbanMeta,
    loadKanbanMeta,
  }
})
