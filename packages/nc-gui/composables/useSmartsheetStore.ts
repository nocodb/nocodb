import type { ColumnType, FilterType, KanbanType, SortType, TableType, ViewType } from 'nocodb-sdk'
import {
  ColumnHelper,
  FormulaDataTypes,
  NcApiVersion,
  UITypes,
  ViewLockType,
  ViewTypes,
  extractFilterFromXwhere,
  isNumericCol,
  isVirtualCol,
  ncIsNaN,
} from 'nocodb-sdk'
import type { Ref } from 'vue'
import { EventBusEnum, type SmartsheetStoreEvents } from '#imports'

const [useProvideSmartsheetStore, useSmartsheetStore] = useInjectionState(
  (
    // _view is deprecated, we use viewsStore instead
    _view: Ref<ViewType | undefined>,
    meta: Ref<TableType | KanbanType | undefined>,
    shared = false,
    initialSorts?: Ref<SortType[]>,
    initialFilters?: Ref<FilterType[]>,
  ) => {
    const isPublic = inject(IsPublicInj, ref(false))

    const { $api } = useNuxtApp()

    const router = useRouter()
    const route = router.currentRoute

    const { user, isMobileMode } = useGlobal()

    const { metas } = useMetas()

    const { activeView: view, activeNestedFilters, activeSorts } = storeToRefs(useViewsStore())

    const baseStore = useBase()

    const { isMysql, isPg } = baseStore

    const { sqlUis, base } = storeToRefs(baseStore)

    const sqlUi = computed(() =>
      (meta.value as TableType)?.source_id ? sqlUis.value[(meta.value as TableType).source_id!] : Object.values(sqlUis.value)[0],
    )

    const { search } = useFieldQuery()

    const eventBus = useEventBus<SmartsheetStoreEvents>(EventBusEnum.SmartsheetStore)

    const isLocked = computed(
      () =>
        (view.value?.lock_type === ViewLockType.Personal && user.value?.id !== view.value?.owned_by) ||
        view.value?.lock_type === ViewLockType.Locked,
    )
    const isPkAvail = computed(() => (meta.value as TableType)?.columns?.some((c) => c.pk))
    const isGrid = computed(() => view.value?.type === ViewTypes.GRID)
    const isForm = computed(() => view.value?.type === ViewTypes.FORM)
    const isGallery = computed(() => view.value?.type === ViewTypes.GALLERY)
    const isCalendar = computed(() => view.value?.type === ViewTypes.CALENDAR)
    const isKanban = computed(() => view.value?.type === ViewTypes.KANBAN)
    const isMap = computed(() => view.value?.type === ViewTypes.MAP)
    const isSharedForm = computed(() => isForm.value && shared)
    const isDefaultView = computed(() => view.value?.is_default)
    const gridEditEnabled = ref(true)

    const isExternalSource = computed(
      () => !!base.value?.sources?.some((s) => s.id === (meta.value as TableType)?.source_id && !s.is_meta && !s.is_local),
    )

    const isAlreadyShownUpgradeModal = ref(false)

    const aliasColObjMap = computed(() => {
      const colObj = ((meta.value as TableType)?.columns || [])?.reduce((acc, col) => {
        acc[col.title] = col

        return acc
      }, {} as Record<string, ColumnType>)
      return colObj
    })

    const filtersFromUrlParams = computed(() => {
      if (route.value.query.where) {
        return extractFilterFromXwhere(
          { api_version: NcApiVersion.V1 },
          route.value.query.where as string,
          aliasColObjMap.value,
          false,
        )
      }
    })
    const validFiltersFromUrlParams = computed(() => {
      return !filtersFromUrlParams.value?.errors?.length ? filtersFromUrlParams.value?.filters || [] : []
    })

    const whereQueryFromUrl = computed(() => {
      if (filtersFromUrlParams.value?.errors?.length) {
        return
      }

      return route.value.query.where
    })

    const totalRowsWithSearchQuery = ref(0)

    const totalRowsWithoutSearchQuery = ref(0)

    const fetchTotalRowsWithSearchQuery = computed(() => {
      return search.value.query?.trim() && !isMobileMode.value && (isGrid.value || isGallery.value)
    })

    const getValidSearchQueryForColumn = (col: ColumnType, query?: string, tableMeta?: TableType) => {
      if (!isValidValue(query)) return ''

      let searchQuery = query

      try {
        /**
         * This method can throw errors. so it's important to use a try-catch block when calling it.
         */
        searchQuery = ColumnHelper.serializeValue(searchQuery, {
          col,
          isMysql,
          isPg,
          meta: tableMeta,
          metas: metas.value,
          serializeSearchQuery: true,
        })
      } catch {
        /**
         * If it is a virtual column, then send query as it is
         */
        if (!isVirtualCol(col)) {
          searchQuery = ''
          /**
           * We don't have to anything if serializeValue is not valid for current column
           */
          console.log('invalid search query for column', col.title, searchQuery)
        } else if (col.uidt !== UITypes.Formula) {
          searchQuery = query
        }
      }

      if (isVirtualCol(col) && !isValidValue(searchQuery)) {
        searchQuery = query
      }

      if (!isValidValue(searchQuery)) return ''

      return searchQuery ?? ''
    }

    const xWhere = computed(() => {
      let where

      // if where is already present in the query, use that
      if (whereQueryFromUrl.value) {
        where = whereQueryFromUrl.value
      }

      const col =
        (meta.value as TableType)?.columns?.find(({ id }) => id === search.value.field) ||
        (meta.value as TableType)?.columns?.find((v) => v.pv)
      if (!col) return where

      if (!search.value.query.trim()) return where

      let searchQuery = search.value.query.trim()

      searchQuery = getValidSearchQueryForColumn(col, searchQuery, meta.value as TableType)

      if (!isValidValue(searchQuery)) return where

      // concat the where clause if query is present
      if (
        (col.uidt !== UITypes.Formula || getFormulaColDataType(col) !== FormulaDataTypes.NUMERIC) &&
        !isNumericCol(col) &&
        sqlUi.value &&
        ['text', 'string'].includes(sqlUi.value.getAbstractType(col)) &&
        col.dt !== 'bigint'
      ) {
        where = `${where ? `${where}~and` : ''}(${col.title},like,%${searchQuery}%)`
      } else {
        where = `${where ? `${where}~and` : ''}(${col.title},eq,${searchQuery})`
      }

      return where
    })

    const isActionPaneActive = ref(false)

    const actionPaneSize = ref(40)

    const isSqlView = computed(() => (meta.value as TableType)?.type === 'view')

    const isSyncedTable = computed(() => !!(meta.value as TableType)?.synced)

    const sorts = ref<SortType[]>(unref(initialSorts) ?? [])
    const nestedFilters = ref<FilterType[]>(unref(initialFilters) ?? [])

    const allFilters = ref<FilterType[]>([])

    watch(
      sorts,
      () => {
        activeSorts.value = sorts.value
      },
      {
        immediate: true,
      },
    )

    watch(
      nestedFilters,
      () => {
        activeNestedFilters.value = nestedFilters.value
      },
      {
        immediate: true,
      },
    )

    const viewColumnsMap = reactive<Record<string, Record<string, any>[]>>({})
    const pendingRequests = new Map()

    const getViewColumns = async (viewId: string) => {
      if (isPublic.value) return []

      if (viewColumnsMap[viewId]) return viewColumnsMap[viewId]

      if (pendingRequests.has(viewId)) {
        return pendingRequests.get(viewId)
      }

      const promise = $api.dbViewColumn
        .list(viewId)
        .then((result) => {
          viewColumnsMap[viewId] = result.list
          pendingRequests.delete(viewId)
          return result.list
        })
        .catch((error) => {
          pendingRequests.delete(viewId)
          throw error
        })

      pendingRequests.set(viewId, promise)

      return promise
    }

    return {
      view,
      meta,
      isLocked,
      $api,
      xWhere,
      isPkAvail,
      isForm,
      isGrid,
      isGallery,
      isKanban,
      isMap,
      isCalendar,
      isSharedForm,
      sorts,
      nestedFilters,
      isSqlView,
      eventBus,
      sqlUi,
      allFilters,
      isDefaultView,
      actionPaneSize,
      isActionPaneActive,
      viewColumnsMap,
      getViewColumns,
      isExternalSource,
      isAlreadyShownUpgradeModal,
      filtersFromUrlParams,
      whereQueryFromUrl,
      validFiltersFromUrlParams,
      isSyncedTable,
      totalRowsWithSearchQuery,
      totalRowsWithoutSearchQuery,
      fetchTotalRowsWithSearchQuery,
      gridEditEnabled,
      getValidSearchQueryForColumn,
    }
  },
  'smartsheet-store',
)

export { useProvideSmartsheetStore }

export function useSmartsheetStoreOrThrow() {
  const state = useSmartsheetStore()

  if (!state) throw new Error('Please call `useProvideSmartsheetStore` on the appropriate parent component')

  return state
}
