import type {
  Api,
  ExportTypes,
  FilterType,
  KanbanType,
  PaginatedType,
  RequestParams,
  SortType,
  TableType,
  ViewType,
} from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
import { computed, useGlobal, useMetas, useNuxtApp, useState } from '#imports'

export function useSharedView() {
  const nestedFilters = ref<(FilterType & { status?: 'update' | 'delete' | 'create'; parentId?: string })[]>([])

  const { appInfo } = $(useGlobal())

  const { project } = useProject()

  const appInfoDefaultLimit = appInfo.defaultLimit || 25

  const paginationData = useState<PaginatedType>('paginationData', () => ({ page: 1, pageSize: appInfoDefaultLimit }))

  const sharedView = useState<ViewType | undefined>('sharedView', () => undefined)

  const sorts = ref<SortType[]>([])

  const password = useState<string | undefined>('password', () => undefined)

  const allowCSVDownload = useState<boolean>('allowCSVDownload', () => false)

  const meta = useState<TableType | KanbanType | undefined>('meta', () => undefined)

  const formColumns = computed(
    () =>
      (meta.value as TableType)?.columns
        ?.filter(
          (f: Record<string, any>) =>
            f.show &&
            f.uidt !== UITypes.Rollup &&
            f.uidt !== UITypes.Lookup &&
            f.uidt !== UITypes.Formula &&
            f.uidt !== UITypes.Barcode &&
            f.uidt !== UITypes.QrCode,
        )
        .sort((a: Record<string, any>, b: Record<string, any>) => a.order - b.order)
        .map((c: Record<string, any>) => ({ ...c, required: !!(c.required || 0) })) ?? [],
  )

  const { $api } = useNuxtApp()

  const { setMeta } = useMetas()

  const loadSharedView = async (viewId: string, localPassword: string | undefined = undefined) => {
    const viewMeta: Record<string, any> = await $api.public.sharedViewMetaGet(viewId, {
      headers: {
        'xc-password': localPassword ?? password.value,
      },
    })
    try {
      allowCSVDownload.value = (typeof viewMeta.meta === 'string' ? JSON.parse(viewMeta.meta) : viewMeta.meta)?.allowCSVDownload
    } catch {
      allowCSVDownload.value = false
    }

    if (localPassword) password.value = localPassword
    sharedView.value = { title: '', ...viewMeta }
    meta.value = { ...viewMeta.model }

    let order = 1
    meta.value!.columns = [...viewMeta.model.columns]
      .filter((c) => c.show)
      .map((c) => ({ ...c, order: order++ }))
      .sort((a, b) => a.order - b.order)

    await setMeta(viewMeta.model)

    // if project is not defined then set it with an object containing base
    if (!project.value?.bases)
      project.value = {
        bases: [
          {
            id: viewMeta.base_id,
            type: viewMeta.client,
          },
        ],
      }

    const relatedMetas = { ...viewMeta.relatedMetas }
    Object.keys(relatedMetas).forEach((key) => setMeta(relatedMetas[key]))
  }

  const fetchSharedViewData = async ({ sortsArr, filtersArr }: { sortsArr: SortType[]; filtersArr: FilterType[] }) => {
    if (!sharedView.value) return

    const page = paginationData.value.page || 1
    const pageSize = paginationData.value.pageSize || appInfoDefaultLimit

    const { data } = await $api.public.dataList(
      sharedView.value.uuid!,
      {
        offset: (page - 1) * pageSize,
        filterArrJson: JSON.stringify(filtersArr ?? nestedFilters.value),
        sortArrJson: JSON.stringify(sortsArr ?? sorts.value),
      } as any,
      {
        headers: {
          'xc-password': password.value,
        },
      },
    )
    return data
  }

  const fetchSharedViewGroupedData = async (columnId: string, params: Parameters<Api<any>['dbViewRow']['list']>[4] = {}) => {
    if (!sharedView.value) return

    const page = paginationData.value.page || 1
    const pageSize = paginationData.value.pageSize || appInfoDefaultLimit

    return await $api.public.groupedDataList(
      sharedView.value.uuid!,
      columnId,
      {
        offset: (page - 1) * pageSize,
        filterArrJson: JSON.stringify(nestedFilters.value),
        sortArrJson: JSON.stringify(sorts.value),
        ...params,
      } as any,
      {
        headers: {
          'xc-password': password.value,
        },
      },
    )
  }

  const exportFile = async (
    fields: any[],
    offset: number,
    type: ExportTypes.EXCEL | ExportTypes.CSV,
    responseType: 'base64' | 'blob',
    { sortsArr, filtersArr }: { sortsArr: SortType[]; filtersArr: FilterType[] } = { sortsArr: [], filtersArr: [] },
  ) => {
    return await $api.public.csvExport(sharedView.value!.uuid!, type, {
      format: responseType,
      query: {
        fields: fields.map((field) => field.title),
        offset,
        filterArrJson: JSON.stringify(filtersArr ?? nestedFilters.value),
        sortArrJson: JSON.stringify(sortsArr ?? sorts.value),
      },
      headers: {
        'xc-password': password.value,
      },
    } as RequestParams)
  }

  return {
    sharedView,
    loadSharedView,
    meta,
    nestedFilters,
    fetchSharedViewData,
    fetchSharedViewGroupedData,
    paginationData,
    sorts,
    exportFile,
    formColumns,
    allowCSVDownload,
  }
}
