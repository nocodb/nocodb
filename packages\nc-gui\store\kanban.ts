import { message } from 'ant-design-vue'
import type { KanbanType } from 'nocodb-sdk'
import type { Row as RowType } from '../lib/types'
import {
  IsPublicInj,
  computed,
  deepCompare,
  enumColor,
  inject,
  parseProp,
  reactive,
  ref,
  useBase,
  useFieldQuery,
  useGlobal,
  useInjectionState,
  useMetas,
  useNuxtApp,
  useSharedView,
  useSmartsheetStoreOrThrow,
  useUndoRedo,
  useViewData,
  watch,
} from '#imports'

const [useProvideKanbanViewStore, useKanbanViewStore] = useInjectionState(
  (
    meta: Ref<KanbanType | undefined>,
    viewMeta: Ref<ViewType | undefined>,
    shared = false,
  ) => {
    if (!meta) {
      throw new Error('Table meta is not available')
    }

    const isPublic = inject(IsPublicInj, ref(false))

    const { t } = useI18n()

    const { api } = useApi()

    const { base } = useBase()

    const { $e, $api } = useNuxtApp()

    const { sorts, nestedFilters } = useSmartsheetStoreOrThrow()

    const { isUIAllowed } = useRoles()

    const { addUndo, clone, defineViewScope } = useUndoRedo()

    const groupingField = ref<string>('')

    const groupingFieldColOptions = ref<Record<string, any>[]>([])

    const groupingFieldColumn = ref<Record<string, any>>()

    const stackMetaObj = ref<Record<string, Record<string, any>>>({})

    const formattedData = ref<Map<string, RowType[]>>(new Map<string, RowType[]>())

    const countByStack = ref<Map<string, number>>(new Map<string, number>())

    const groupingFieldTitleRef = ref<string>('')

    const loadedStacksRef = ref<Set<string>>(new Set())

    const activeStackId = ref<string>('')

    const loadMoreLoadingStack = ref<string | null>(null)

    const isCompactMode = ref<boolean>(false)

    // ... rest of store implementation
    
    return {
      groupingField,
      groupingFieldColOptions,
      groupingFieldColumn,
      stackMetaObj,
      formattedData,
      countByStack,
      groupingFieldTitleRef,
      loadedStacksRef,
      activeStackId,
      loadMoreLoadingStack,
      isCompactMode,
      // ... other exports
    }
  },
)

export { useProvideKanbanViewStore }

export function useKanbanViewStoreOrThrow() {
  const kanbanViewStore = useKanbanViewStore()

  if (kanbanViewStore == null) throw new Error('Please call `useProvideKanbanViewStore` on the appropriate parent component')

  return kanbanViewStore
}
