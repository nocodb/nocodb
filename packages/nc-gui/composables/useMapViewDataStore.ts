import type { ComputedRef, Ref } from 'vue'
import type { ColumnType, MapType, TableType, ViewType } from 'nocodb-sdk'
import { ref, useInjectionState, useMetas } from '#imports'
import type { Row } from '~/lib'

const formatData = (list: Row[]) =>
  list.map((row) => ({
    row: { ...row },
    oldRow: { ...row },
    rowMeta: {},
  }))

const [useProvideMapViewStore, useMapViewStore] = useInjectionState(
  (
    meta: Ref<TableType | MapType | undefined>,
    viewMeta: Ref<ViewType | MapType | undefined> | ComputedRef<(ViewType & { id: string }) | undefined>,
  ) => {
    const formattedData = ref<Row[]>([])

    const { api } = useApi()
    const { project } = useProject()
    const { $api } = useNuxtApp()

    const { isUIAllowed } = useUIPermission()

    const mapMetaData = ref<MapType>({})

    const geoDataFieldColumn = ref<ColumnType | undefined>()

    async function loadMapMeta() {
      if (!viewMeta?.value?.id || !meta?.value?.columns) return
      mapMetaData.value = await $api.dbView.mapRead(viewMeta.value.id)
      geoDataFieldColumn.value =
        (meta.value.columns as ColumnType[]).filter((f) => f.id === mapMetaData.value.fk_geo_data_col_id)[0] || {}
    }

    async function loadMapData() {
      if (!viewMeta?.value?.id || !meta?.value?.columns) return

      const res = await api.dbViewRow.list('noco', project.value.id!, meta.value!.id!, viewMeta.value!.id!)

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

        return insertedData
      } catch (error: any) {
        message.error(await extractSdkResponseErrorMsg(error))
      } finally {
        if (currentRow.rowMeta) currentRow.rowMeta.saving = false
      }
    }

    return {
      formattedData,
      loadMapData,
      loadMapMeta,
      updateMapMeta,
      mapMetaData,
      geoDataFieldColumn,
      insertRow,
    }
  },
)

export { useProvideMapViewStore }

export function useMapViewStoreOrThrow() {
  const mapViewStore = useMapViewStore()

  if (mapViewStore == null) throw new Error('Please call `useProvideMapViewStore` on the appropriate parent component')

  return mapViewStore
}
