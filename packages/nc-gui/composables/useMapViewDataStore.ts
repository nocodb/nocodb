import type { ComputedRef, Ref } from 'vue'
import type { ColumnType, MapType, PaginatedType, TableType, ViewType } from 'nocodb-sdk'

const formatData = (list: Record<string, any>[]) =>
  list.map(
    (row) =>
      ({
        row: { ...row },
        oldRow: { ...row },
        rowMeta: {},
      } as Row),
  )

const [useProvideMapViewStore, useMapViewStore] = useInjectionState(
  (
    meta: Ref<(MapType & { id: string }) | undefined>,
    viewMeta: Ref<(ViewType | MapType | undefined) & { id: string }> | ComputedRef<(ViewType & { id: string }) | undefined>,
    shared = false,
    where?: ComputedRef<string | undefined>,
  ) => {
    if (!meta) {
      throw new Error('Table meta is not available')
    }

    const defaultPageSize = 1000

    const formattedData = ref<Row[]>([])

    const { api } = useApi()

    const { base } = storeToRefs(useBase())

    const { $api } = useNuxtApp()

    const { isUIAllowed } = useRoles()

    const isPublic = ref(shared) || inject(IsPublicInj, ref(false))

    const { sorts, nestedFilters } = useSmartsheetStoreOrThrow()

    const { sharedView, fetchSharedViewData } = useSharedView()

    const mapMetaData = ref<MapType>({})

    const geoDataFieldColumn = ref<ColumnType | undefined>()

    const paginationData = ref<PaginatedType>({ page: 1, pageSize: defaultPageSize })

    const queryParams = computed(() => ({
      limit: paginationData.value.pageSize ?? defaultPageSize,
      where: where?.value ?? '',
    }))

    async function syncCount() {
      const { count } = await $api.dbViewRow.count(
        NOCO,
        base?.value?.title as string,
        meta?.value?.id as string,
        viewMeta?.value?.id as string,
      )
      paginationData.value.totalRows = count
    }

    async function loadMapMeta() {
      if (!viewMeta?.value?.id || !meta?.value?.columns) return
      mapMetaData.value = isPublic.value ? (sharedView.value?.view as MapType) : await $api.dbView.mapRead(viewMeta.value.id)

      geoDataFieldColumn.value =
        (meta.value.columns as ColumnType[]).filter((f) => f.id === mapMetaData.value.fk_geo_data_col_id)[0] || {}
    }

    async function loadMapData() {
      if ((!base?.value?.id || !meta.value?.id || !viewMeta.value?.id) && !isPublic?.value) return

      const res = !isPublic.value
        ? await api.dbViewRow.list('noco', base.value.id!, meta.value!.id!, viewMeta.value!.id!, {
            ...queryParams.value,
            ...(isUIAllowed('filterSync') ? {} : { filterArrJson: JSON.stringify(nestedFilters.value) }),
            where: where?.value,
          })
        : await fetchSharedViewData({ sortsArr: sorts.value, filtersArr: nestedFilters.value })

      formattedData.value = formatData(res!.list)
    }

    async function updateMapMeta(updateObj: Partial<MapType>) {
      if (!viewMeta?.value?.id || !isUIAllowed('dataEdit', { skipSourceCheck: true })) return
      await $api.dbView.mapUpdate(viewMeta.value.id, updateObj)
    }

    const { getMeta } = useMetas()

    async function insertRow(
      currentRow: Row,
      ltarState: Record<string, any> = {},
      {
        metaValue = meta.value,
        viewMetaValue = viewMeta.value,
      }: { metaValue?: MapType & { id: string }; viewMetaValue?: (ViewType | MapType) & { id: string } } = {},
    ) {
      const row = currentRow.row
      if (currentRow.rowMeta) currentRow.rowMeta.saving = true
      try {
        const { missingRequiredColumns, insertObj } = await populateInsertObject({
          meta: metaValue as TableType,
          ltarState,
          getMeta,
          row,
        })

        if (missingRequiredColumns.size) return

        const insertedData = await $api.dbViewRow.create(
          NOCO,
          base?.value.id as string,
          metaValue?.id as string,
          viewMetaValue?.id as string,
          insertObj,
        )

        Object.assign(currentRow, {
          row: { ...insertedData, ...row },
          rowMeta: { ...(currentRow.rowMeta || {}), new: undefined },
          oldRow: { ...insertedData },
        })

        syncCount()

        return insertedData
      } catch (error: any) {
        message.error(await extractSdkResponseErrorMsg(error))
      } finally {
        if (currentRow.rowMeta) currentRow.rowMeta.saving = false
      }
    }

    function addEmptyRow(addAfter = formattedData.value.length) {
      formattedData.value.splice(addAfter, 0, {
        row: {},
        oldRow: {},
        rowMeta: { new: true },
      })

      return formattedData.value[addAfter]
    }

    return {
      formattedData,
      loadMapData,
      loadMapMeta,
      updateMapMeta,
      mapMetaData,
      geoDataFieldColumn,
      addEmptyRow,
      insertRow,
      syncCount,
      paginationData,
    }
  },
)

export { useProvideMapViewStore }

export function useMapViewStoreOrThrow() {
  const mapViewStore = useMapViewStore()

  if (mapViewStore == null) throw new Error('Please call `useProvideMapViewStore` on the appropriate parent component')

  return mapViewStore
}
