import type { ExportTypes, FilterType, PaginatedType, RequestParams, SortType, TableType, ViewType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
import { computed, useGlobal, useMetas, useNuxtApp, useState } from '#imports'

export function useSharedView() {
  const nestedFilters = useState<(FilterType & { status?: 'update' | 'delete' | 'create'; parentId?: string })[]>(
    'nestedFilters',
    () => [],
  )

  const { appInfo } = $(useGlobal())

  const appInfoDefaultLimit = appInfo.defaultLimit || 25

  const paginationData = useState<PaginatedType>('paginationData', () => ({ page: 1, pageSize: appInfoDefaultLimit }))

  const sharedView = useState<ViewType | undefined>('sharedView', () => undefined)

  const sorts = useState<SortType[]>('sorts', () => [])

  const password = useState<string | undefined>('password', () => undefined)

  const allowCSVDownload = useState<boolean>('allowCSVDownload', () => false)

  const meta = useState<TableType | undefined>('meta', () => undefined)

  const formColumns = computed(
    () =>
      meta.value?.columns
        ?.filter(
          (f: Record<string, any>) =>
            f.show && f.uidt !== UITypes.Rollup && f.uidt !== UITypes.Lookup && f.uidt !== UITypes.Formula,
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

    allowCSVDownload.value = JSON.parse(viewMeta.meta)?.allowCSVDownload

    if (localPassword) password.value = localPassword
    sharedView.value = { title: '', ...viewMeta }
    meta.value = { ...viewMeta.model }

    let order = 1
    meta.value!.columns = [...viewMeta.model.columns]
      .filter((c) => c.show)
      .map((c) => ({ ...c, order: order++ }))
      .sort((a, b) => a.order - b.order)

    await setMeta(viewMeta.model)

    const relatedMetas = { ...viewMeta.relatedMetas }
    Object.keys(relatedMetas).forEach((key) => setMeta(relatedMetas[key]))
  }

  const fetchSharedViewData = async () => {
    if (!sharedView.value) return

    const page = paginationData.value.page || 1
    const pageSize = paginationData.value.pageSize || appInfoDefaultLimit

    const { data } = await $api.public.dataList(
      sharedView.value.uuid!,
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
    return await $api.public.csvExport(sharedView.value!.uuid!, type, {
      format: responseType,
      query: {
        fields: fields.map((field) => field.title),
        offset,
        sortArrJson: JSON.stringify(sorts.value),

        filterArrJson: JSON.stringify(nestedFilters.value),
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
    paginationData,
    sorts,
    exportFile,
    formColumns,
    allowCSVDownload,
  }
}
