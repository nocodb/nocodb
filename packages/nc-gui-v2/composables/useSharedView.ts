import type { ColumnType, FilterType, PaginatedType, TableType, ViewType } from 'nocodb-sdk'
import { useNuxtApp } from '#app'

const filters = ref<(FilterType & { status?: 'update' | 'delete' | 'create'; parentId?: string })[]>([])
const paginationData = ref<PaginatedType>({ page: 1, pageSize: 25 })
const sharedView = ref<ViewType>()

export function useSharedView() {
  const meta = ref<TableType>(() => sharedView.value?.model)
  const columns = ref<ColumnType[]>(() => sharedView.value?.model?.columns ?? [])

  const { $api } = useNuxtApp()
  const { setMeta } = useMetas()

  const loadSharedView = async (viewId: string) => {
    const viewMeta = await $api.public.sharedViewMetaGet(viewId)
    sharedView.value = viewMeta

    meta.value = viewMeta.model
    columns.value = viewMeta.model.columns

    setMeta(viewMeta.model)

    const relatedMetas = { ...viewMeta.relatedMetas }
    Object.keys(relatedMetas).forEach((key) => setMeta(relatedMetas[key]))
  }

  const fetchSharedViewData = async () => {
    const page = paginationData.value.page || 1
    const pageSize = paginationData.value.pageSize || 25

    const { data } = await $api.public.dataList(sharedView?.value?.uuid, {
      offset: (page - 1) * pageSize,
      filterArrJson: JSON.stringify(filters.value),
    } as any)

    return data
  }

  return { sharedView, loadSharedView, meta, columns, filters, fetchSharedViewData, paginationData }
}
