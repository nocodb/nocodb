import { reactive } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import type { ColumnType, MapType, PaginatedType, TableType, ViewType } from 'nocodb-sdk'
import { IsPublicInj, ref, useInjectionState, useMetas, useProject } from '#imports'
import type { Row } from '~/lib'

export const geodataToggleState = reactive({ show: false })

const formatData = (list: Row[]) =>
  list.map((row) => ({
    row: { ...row },
    oldRow: { ...row },
    rowMeta: {},
  }))

const [useProvideMapViewStore, useMapViewStore] = useInjectionState(
  (
    meta: Ref<TableType | undefined>,
    viewMeta: Ref<ViewType | MapType | undefined> | ComputedRef<(ViewType & { id: string }) | undefined>,
    where?: ComputedRef<string | undefined>,
  ) => {
    if (!meta) {
      throw new Error('Table meta is not available')
    }

    const formattedData = ref<Row[]>([])

    const { api } = useApi()

    const { project } = useProject()

    const { $api } = useNuxtApp()

    const { isUIAllowed } = useUIPermission()

    const isPublic = inject(IsPublicInj, ref(false))

    const { sorts, nestedFilters } = useSmartsheetStoreOrThrow()

    const { fetchSharedViewData } = useSharedView()

    const mapMetaData = ref<MapType>({})

    const geoDataFieldColumn = ref<ColumnType | undefined>()

    const appInfoDefaultLimit = 1000

    const paginationData = ref<PaginatedType>({ page: 1, pageSize: appInfoDefaultLimit })

    const queryParams = computed(() => ({
      limit: paginationData.value.pageSize ?? appInfoDefaultLimit,
      where: where?.value ?? '',
    }))

    async function syncCount() {
      if (!isPublic) {
        const { count } = await $api.dbViewRow.count(
          NOCO,
          project?.value?.title as string,
          meta?.value?.id as string,
          viewMeta?.value?.id as string,
        )
        paginationData.value.totalRows = count
      }
    }

    async function loadMapMeta() {
      if (!viewMeta?.value?.id || !meta?.value?.columns) return
      mapMetaData.value = await $api.dbView.mapRead(viewMeta.value.id)
      geoDataFieldColumn.value =
        (meta.value.columns as ColumnType[]).filter((f) => f.id === mapMetaData.value.fk_geo_data_col_id)[0] || {}
    }

    async function loadMapData() {
      if ((!project?.value?.id || !meta.value?.id || !viewMeta.value?.id) && !isPublic.value) return

      const res = !isPublic.value
        ? await api.dbViewRow.list('noco', project.value.id!, meta.value!.id!, viewMeta.value!.id!, {
            ...queryParams.value,
            ...(isUIAllowed('filterSync') ? {} : { filterArrJson: JSON.stringify(nestedFilters.value) }),
            where: where?.value,
          })
        : await fetchSharedViewData({ sortsArr: sorts.value, filtersArr: nestedFilters.value })

      formattedData.value = formatData(res.list)
    }

    async function updateMapMeta(updateObj: Partial<MapType>) {
      if (!viewMeta?.value?.id || !isUIAllowed('xcDatatableEditable')) return
      await $api.dbView.mapUpdate(viewMeta.value.id, {
        ...mapMetaData.value,
        ...updateObj,
      })
    }

    const { getMeta } = useMetas()

    async function insertRow(
      currentRow: Row,
      _rowIndex = formattedData.value?.length,
      ltarState: Record<string, any> = {},
      {
        metaValue = meta.value,
        viewMetaValue = viewMeta.value,
      }: { metaValue?: MapType; viewMetaValue?: ViewType | MapType } = {},
    ) {
      const row = currentRow.row
      if (currentRow.rowMeta) currentRow.rowMeta.saving = true
      try {
        const { missingRequiredColumns, insertObj } = await populateInsertObject({
          meta: metaValue!,
          ltarState,
          getMeta,
          row,
        })

        if (missingRequiredColumns.size) return

        const insertedData = await $api.dbViewRow.create(
          NOCO,
          project?.value.id as string,
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
      geodataToggleState,
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
