import type { FilterType, KanbanType, SortType, TableType, ViewType } from 'nocodb-sdk'
import { NcApiVersion, ViewLockType, ViewTypes, extractFilterFromXwhere } from 'nocodb-sdk'
import type { Ref } from 'vue'
import type { SmartsheetStoreEvents } from '#imports'

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

    const { user } = useGlobal()

    const { activeView: view, activeNestedFilters, activeSorts } = storeToRefs(useViewsStore())

    const baseStore = useBase()

    const { sqlUis } = storeToRefs(baseStore)

    const sqlUi = computed(() =>
      (meta.value as TableType)?.source_id ? sqlUis.value[(meta.value as TableType).source_id!] : Object.values(sqlUis.value)[0],
    )

    const { search } = useFieldQuery()

    const eventBus = useEventBus<SmartsheetStoreEvents>(Symbol('SmartsheetStore'))

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

    const aliasColObjMap = computed(() => {
      const colObj = (meta.value as TableType)?.columns?.reduce((acc, col) => {
        acc[col.title] = col
        return acc
      }, {})
      return colObj
    })

    const whereQueryFromUrlError = computed(() => {
      if (route.value.query.where) {
        return extractFilterFromXwhere({ api_version: NcApiVersion.V1 }, route.value.query.where, aliasColObjMap.value, false)
          ?.errors
      }
    })
    const whereQueryFromUrl = computed(() => {
      if (whereQueryFromUrlError.value?.length) {
        return
      }

      return route.value.query.where
    })

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

      // concat the where clause if query is present
      if (sqlUi.value && ['text', 'string'].includes(sqlUi.value.getAbstractType(col)) && col.dt !== 'bigint') {
        where = `${where ? `${where}~and` : ''}(${col.title},like,%${search.value.query.trim()}%)`
      } else {
        where = `${where ? `${where}~and` : ''}(${col.title},eq,${search.value.query.trim()})`
      }

      return where
    })

    const isActionPaneActive = ref(false)

    const actionPaneSize = ref(40)

    const isSqlView = computed(() => (meta.value as TableType)?.type === 'view')
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
