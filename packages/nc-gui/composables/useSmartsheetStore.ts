import { ViewTypes } from 'nocodb-sdk'
import type { FilterType, KanbanType, SortType, TableType, ViewType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { computed, ref, unref, useFieldQuery, useInjectionState, useNuxtApp, useProject } from '#imports'

const [useProvideSmartsheetStore, useSmartsheetStore] = useInjectionState(
  (
    view: Ref<ViewType | undefined>,
    meta: Ref<TableType | KanbanType | undefined>,
    shared = false,
    initialSorts?: Ref<SortType[]>,
    initialFilters?: Ref<FilterType[]>,
  ) => {
    const { $api } = useNuxtApp()

    const { sqlUi } = useProject()

    const cellRefs = ref<HTMLTableDataCellElement[]>([])

    const { search } = useFieldQuery(view)

    // getters
    const isLocked = computed(() => view.value?.lock_type === 'locked')
    const isPkAvail = computed(() => (meta.value as TableType)?.columns?.some((c) => c.pk))
    const isGrid = computed(() => view.value?.type === ViewTypes.GRID)
    const isForm = computed(() => view.value?.type === ViewTypes.FORM)
    const isGallery = computed(() => view.value?.type === ViewTypes.GALLERY)
    const isKanban = computed(() => view.value?.type === ViewTypes.KANBAN)
    const isSharedForm = computed(() => isForm.value && shared)
    const xWhere = computed(() => {
      let where
      const col =
        (meta.value as TableType)?.columns?.find(({ id }) => id === search.value.field) ||
        (meta.value as TableType)?.columns?.find((v) => v.pv)
      if (!col) return

      if (!search.value.query.trim()) return
      if (['text', 'string'].includes(sqlUi.value.getAbstractType(col)) && col.dt !== 'bigint') {
        where = `(${col.title},like,%${search.value.query.trim()}%)`
      } else {
        where = `(${col.title},eq,${search.value.query.trim()})`
      }
      return where
    })

    const isSqlView = computed(() => (meta.value as TableType)?.type === 'view')
    const sorts = ref<SortType[]>(unref(initialSorts) ?? [])
    const nestedFilters = ref<FilterType[]>(unref(initialFilters) ?? [])

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
      cellRefs,
      isSharedForm,
      sorts,
      nestedFilters,
      isSqlView,
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
