import type { ColumnType, ExportTypes, FilterType, PaginatedType, SortType, TableType, ViewType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
import { useNuxtApp } from '#app'

export function useSharedView() {
  const nestedFilters = useState<(FilterType & { status?: 'update' | 'delete' | 'create'; parentId?: string })[]>(
    'nestedFilters',
    () => [],
  )
  const paginationData = useState<PaginatedType>('paginationData', () => ({ page: 1, pageSize: 25 }))
  const sharedView = useState<ViewType>('sharedView')
  const sorts = useState<SortType[]>('sorts', () => [])
  const password = useState<string | undefined>('password')
  const allowCSVDownload = useState<boolean>('allowCSVDownload', () => false)

  const meta = ref<TableType>(sharedView.value?.model)
  const columns = ref<ColumnType[]>(sharedView.value?.model?.columns)
  const formColumns = computed(
    () =>
      columns.value
        .filter(
          (f: Record<string, any>) =>
            f.show && f.uidt !== UITypes.Rollup && f.uidt !== UITypes.Lookup && f.uidt !== UITypes.Formula,
        )
        .sort((a: Record<string, any>, b: Record<string, any>) => a.order - b.order)
        .map((c: Record<string, any>) => ({ ...c, required: !!(c.required || 0) })) ?? [],
  )

  const { $api } = useNuxtApp()
  const { setMeta } = useMetas()

  const loadSharedView = async (viewId: string, localPassword: string | undefined = undefined) => {
    const viewMeta = await $api.public.sharedViewMetaGet(viewId, {
      headers: {
        'xc-password': localPassword ?? password.value,
      },
    })

    allowCSVDownload.value = JSON.parse(viewMeta.meta).allowCSVDownload

    if (localPassword) password.value = localPassword
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

    const { data } = await $api.public.dataList(
      sharedView?.value?.uuid,
      {
        offset: (page - 1) * pageSize,
        filterArrJson: JSON.stringify(nestedFilters.value),
        sortArrJson: JSON.stringify(sorts.value),
      } as any,
      {
        headers: {
          'xc-password': password.value,
        },
      },
    )

    return data
  }

  const exportFile = async (
    fields: any[],
    offset: number,
    type: ExportTypes.EXCEL | ExportTypes.CSV,
    responseType: 'base64' | 'blob',
  ) => {
    return await $api.public.csvExport(sharedView.value?.uuid, type, {
      format: responseType as any,
      query: {
        fields: fields.map((field) => field.title),
        offset,
        sortArrJson: JSON.stringify(sorts.value),

        filterArrJson: JSON.stringify(nestedFilters.value),
      },
      headers: {
        'xc-password': password.value,
      },
    })
  }

  return {
    sharedView,
    loadSharedView,
    meta,
    columns,
    nestedFilters,
    fetchSharedViewData,
    paginationData,
    sorts,
    exportFile,
    formColumns,
    allowCSVDownload,
  }
}
