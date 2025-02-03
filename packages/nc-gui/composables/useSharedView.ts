import type {
  CalendarType,
  ExportTypes,
  FilterType,
  KanbanType,
  MapType,
  PaginatedType,
  RequestParams,
  SortType,
  TableType,
  ViewType,
} from 'nocodb-sdk'
import { UITypes, ViewTypes } from 'nocodb-sdk'
import { setI18nLanguage } from '~/plugins/a.i18n'

export function useSharedView() {
  const router = useRouter()

  const nestedFilters = ref<(FilterType & { status?: 'update' | 'delete' | 'create'; parentId?: string })[]>([])

  const { appInfo } = useGlobal()

  const baseStore = useBase()

  const basesStore = useBases()

  const { basesUser } = storeToRefs(basesStore)

  const { base } = storeToRefs(baseStore)

  const appInfoDefaultLimit = appInfo.value.defaultLimit || 50

  const paginationData = useState<PaginatedType>('paginationData', () => ({
    page: 1,
    pageSize: appInfoDefaultLimit,
  }))

  const sharedView = useState<ViewType | undefined>('sharedView', () => undefined)

  const sorts = ref<SortType[]>([])

  const password = useState<string | undefined>('password', () => undefined)

  provide(SharedViewPasswordInj, password)

  const allowCSVDownload = useState<boolean>('allowCSVDownload', () => false)

  const meta = useState<TableType | KanbanType | MapType | CalendarType | undefined>('meta', () => undefined)

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
      allowCSVDownload.value = parseProp(viewMeta.meta)?.allowCSVDownload
    } catch {
      allowCSVDownload.value = false
    }

    if (localPassword) password.value = localPassword
    sharedView.value = { title: '', ...viewMeta } as ViewType
    meta.value = { ...viewMeta.model }

    if (parseProp(viewMeta.meta)?.language) {
      setI18nLanguage(parseProp(viewMeta.meta).language)
    }

    let order = 1

    // Required for Calendar View
    const rangeFields: Array<string> = []
    if ((sharedView.value?.view as CalendarType)?.calendar_range?.length) {
      for (const range of (sharedView.value?.view as CalendarType)?.calendar_range ?? []) {
        if (range.fk_from_column_id) {
          rangeFields.push(range.fk_from_column_id)
        }
        if ((range as any).fk_to_column_id) {
          rangeFields.push((range as any).fk_to_column_id)
        }
      }
    }

    if (meta.value) {
      meta.value.columns = [...viewMeta.model.columns]
        .filter((c) => c.show || rangeFields.includes(c.id) || (sharedView.value?.type === ViewTypes.GRID && c?.group_by))
        .map((c) => ({ ...c, order: order++ }))
        .sort((a, b) => a.order - b.order)
    }

    await setMeta(viewMeta.model)

    // if base is not defined then set it with an object containing source
    if (!base.value?.sources)
      baseStore.setProject({
        id: viewMeta.base_id,
        sources: [
          {
            id: viewMeta.source_id,
            type: viewMeta.client,
          },
        ],
      })

    const relatedMetas = { ...viewMeta.relatedMetas }
    Object.keys(relatedMetas).forEach((key) => setMeta(relatedMetas[key]))

    if (viewMeta.users) {
      basesUser.value.set(viewMeta.base_id, viewMeta.users)
    }
  }

  const fetchSharedViewData = async (
    param: {
      sortsArr: SortType[]
      filtersArr: FilterType[]
      fields?: any[]
      sort?: any[]
      where?: string
      /** Query params for nested data */
      nested?: any
      offset?: number
      limit?: number
    },
    opts?: {
      isGroupBy?: boolean
      isInfiniteScroll?: boolean
    },
  ) => {
    if (!sharedView.value)
      return {
        list: [],
        pageInfo: {},
      }

    if (!param.offset) {
      const page = paginationData.value.page || 1
      const pageSize = opts?.isInfiniteScroll
        ? param.limit
        : opts?.isGroupBy
        ? appInfo.value.defaultGroupByLimit?.limitRecord || 10
        : paginationData.value.pageSize || appInfoDefaultLimit
      param.offset = (page - 1) * pageSize
      param.limit = sharedView.value?.type === ViewTypes.MAP ? 1000 : pageSize
    }

    return await $api.public.dataList(
      sharedView.value.uuid!,
      {
        ...param,
        filterArrJson: JSON.stringify(param.filtersArr ?? nestedFilters.value),
        sortArrJson: JSON.stringify(param.sortsArr ?? sorts.value),
      } as any,
      {
        headers: {
          'xc-password': password.value,
        },
      },
    )
  }

  const fetchSharedCalendarViewData = async (param: {
    from_date: string
    to_date: string
    sortsArr: SortType[]
    filtersArr: FilterType[]
    fields?: any[]
    sort?: any[]
    where?: string
    /** Query params for nested data */
    nested?: any
    offset?: number
  }) => {
    if (!sharedView.value)
      return {
        list: [],
        pageInfo: {},
      }

    if (!param.offset) {
      const page = paginationData.value.page || 1
      const pageSize = paginationData.value.pageSize || appInfoDefaultLimit
      param.offset = (page - 1) * pageSize
    }

    return await $api.dbCalendarViewRow.publicDataCalendarRowList(
      sharedView.value.uuid!,
      {
        limit: sharedView.value?.type === ViewTypes.CALENDAR ? 3000 : undefined,
        ...param,
        filterArrJson: JSON.stringify(param.filtersArr ?? nestedFilters.value),
        sortArrJson: JSON.stringify(param.sortsArr ?? sorts.value),
      } as any,
      {
        headers: {
          'xc-password': password.value,
        },
      },
    )
  }

  const fetchAggregatedData = async (param: {
    aggregation?: Array<{
      field: string
      type: string
    }>
    filtersArr?: FilterType[]
    where?: string
  }) => {
    if (!sharedView.value) return {}

    return await $api.public.dataTableAggregate(
      sharedView.value.uuid!,
      {
        ...param,
        filterArrJson: JSON.stringify(param.filtersArr ?? nestedFilters.value),
      } as any,
      {
        headers: {
          'xc-password': password.value,
        },
      },
    )
  }

  const fetchBulkAggregatedData = async (
    param: {
      aggregation?: Array<{
        field: string
        type: string
      }>
      filtersArr?: FilterType[]
      where?: string
    },
    bulkFilterList: Array<{
      where: string
      alias: string
    }>,
  ) => {
    if (!sharedView.value) return {}

    return await $api.public.dataTableBulkAggregate(
      sharedView.value.uuid!,
      bulkFilterList,
      {
        ...param,
        filterArrJson: JSON.stringify(param.filtersArr ?? nestedFilters.value),
      } as any,
      {
        headers: {
          'xc-password': password.value,
        },
      },
    )
  }

  const fetchBulkListData = async (
    param: {
      where?: string
    },
    bulkFilterList: Array<{
      where: string
      alias: string
    }>,
  ) => {
    if (!sharedView.value) return {}

    return await $api.public.dataTableBulkDataList(sharedView.value.uuid!, bulkFilterList, {
      ...param,
    } as any)
  }

  const fetchBulkGroupData = async (
    param: {
      filtersArr?: FilterType[]
      where?: string
    },
    bulkFilterList: Array<{
      where: string
      alias: string
    }>,
  ) => {
    if (!sharedView.value) return {}

    return await $api.public.dataTableBulkGroup(
      sharedView.value.uuid!,
      bulkFilterList,
      {
        ...param,
        filterArrJson: JSON.stringify(param.filtersArr ?? nestedFilters.value),
      } as any,
      {
        headers: {
          'xc-password': password.value,
        },
      },
    )
  }

  const fetchSharedViewActiveDate = async (param: {
    from_date: string
    to_date: string
    sortsArr: SortType[]
    filtersArr: FilterType[]
    sort?: any[]
    where?: string
  }) => {
    if (!sharedView.value)
      return {
        list: [],
        pageInfo: {},
      }

    return await $api.public.dataCalendarRowCount(
      sharedView.value.uuid!,
      {
        ...param,
        filterArrJson: JSON.stringify(param.filtersArr ?? nestedFilters.value),
        sortArrJson: JSON.stringify(param.sortsArr ?? sorts.value),
      } as any,
      {
        headers: {
          'xc-password': password.value,
        },
      },
    )
  }

  const fetchCount = async (param: { filtersArr: FilterType[]; where?: string }) => {
    const data = await $api.public.dbViewRowCount(
      sharedView.value.uuid!,
      {
        filterArrJson: JSON.stringify(param.filtersArr ?? nestedFilters.value),
        where: param.where,
      },
      {
        headers: {
          'xc-password': password.value,
        },
      },
    )

    return data
  }

  const fetchSharedViewGroupedData = async (
    columnId: string,
    { sortsArr, filtersArr }: { sortsArr: SortType[]; filtersArr: FilterType[] },
  ) => {
    if (!sharedView.value) return

    const page = paginationData.value.page || 1
    const pageSize = paginationData.value.pageSize || appInfoDefaultLimit

    return await $api.public.groupedDataList(
      sharedView.value.uuid!,
      columnId,
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
  }

  const fetchSharedViewAttachment = async (columnId: string, rowId: string, urlOrPath: string) => {
    if (!sharedView.value) return

    return await $api.public.dataAttachmentDownload(
      sharedView.value.uuid!,
      columnId,
      rowId,
      {
        urlOrPath,
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

  const setCurrentViewExpandedFormMode = async (viewId: string, mode: 'field' | 'attachment', columnId?: string) => {
    await $api.dbView.update(viewId, {
      expanded_record_mode: mode,
      attachment_mode_column_id: columnId,
    })
  }

  const setCurrentViewExpandedFormAttachmentColumn = async (viewId: string, columnId: string) => {
    await $api.dbView.update(viewId, {
      attachment_mode_column_id: columnId,
    })
  }

  const triggerNotFound = () => {
    const currentQuery = { ...router.currentRoute.value.query, ncNotFound: 'true' }

    router.push({
      path: router.currentRoute.value.path,
      query: currentQuery,
    })
  }

  return {
    sharedView,
    loadSharedView,
    meta,
    nestedFilters,
    fetchSharedViewData,
    fetchSharedViewActiveDate,
    fetchSharedCalendarViewData,
    fetchSharedViewGroupedData,
    fetchAggregatedData,
    fetchBulkAggregatedData,
    fetchSharedViewAttachment,
    fetchBulkGroupData,
    fetchBulkListData,
    paginationData,
    sorts,
    exportFile,
    formColumns,
    allowCSVDownload,
    fetchCount,
    setCurrentViewExpandedFormMode,
    setCurrentViewExpandedFormAttachmentColumn,
    triggerNotFound,
  }
}
