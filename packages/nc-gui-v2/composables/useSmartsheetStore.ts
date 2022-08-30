import { ViewTypes } from 'nocodb-sdk'
import type { FilterType, SortType, TableType, ViewType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { computed, reactive, useInjectionState, useNuxtApp, useProject, useTemplateRefsList } from '#imports'

const [useProvideSmartsheetStore, useSmartsheetStore] = useInjectionState(
  (
    view: Ref<ViewType>,
    meta: Ref<TableType>,
    shared = false,
    initalSorts?: Ref<SortType[]>,
    initialFilters?: Ref<FilterType[]>,
  ) => {
    const { $api } = useNuxtApp()
    const { sqlUi } = useProject()

    const cellRefs = useTemplateRefsList<HTMLTableDataCellElement>()

    // state
    // todo: move to grid view store
    const search = reactive({
      field: '',
      query: '',
    })

    // getters
    const isLocked = computed(() => (view?.value as any)?.lock_type === 'locked')
    const isPkAvail = computed(() => meta?.value?.columns?.some((c) => c.pk))
    const isGrid = computed(() => (view?.value as any)?.type === ViewTypes.GRID)
    const isForm = computed(() => (view?.value as any)?.type === ViewTypes.FORM)
    const isSharedForm = computed(() => isForm?.value && shared)
    const isGallery = computed(() => (view?.value as any)?.type === ViewTypes.GALLERY)
    const xWhere = computed(() => {
      let where
      const col = meta?.value?.columns?.find(({ id }) => id === search.field) || meta?.value?.columns?.find((v) => v.pv)
      if (!col) return

      if (!search.query.trim()) return
      if (['text', 'string'].includes(sqlUi.value.getAbstractType(col)) && col.dt !== 'bigint') {
        where = `(${col.title},like,%${search.query.trim()}%)`
      } else {
        where = `(${col.title},eq,${search.query.trim()})`
      }
      return where
    })
    const sorts = initalSorts ?? ref<SortType[]>([])
    const nestedFilters: Ref<FilterType[]> = initialFilters ?? ref<FilterType[]>([])

    return {
      view,
      meta,
      isLocked,
      $api,
      search,
      xWhere,
      isPkAvail,
      isForm,
      isGrid,
      isGallery,
      cellRefs,
      isSharedForm,
      sorts,
      nestedFilters,
    }
  },
  'smartsheet-store',
)

export { useProvideSmartsheetStore }

export function useSmartsheetStoreOrThrow() {
  const smartsheetStore = useSmartsheetStore()
  if (smartsheetStore == null) throw new Error('Please call `useSmartsheetStore` on the appropriate parent component')
  return smartsheetStore
}
