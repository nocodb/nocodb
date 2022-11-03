import type { ComputedRef, Ref } from 'vue'
import type { MapType, TableType, ViewType } from 'nocodb-sdk'
import { ref, useInjectionState } from '#imports'
import type { Row } from '~/lib'

const [useProvideMapViewStore, useMapViewStore] = useInjectionState(
  (
    meta: Ref<TableType | MapType | undefined>,
    viewMeta: Ref<ViewType | MapType | undefined> | ComputedRef<(ViewType & { id: string }) | undefined>,
  ) => {
    const formattedData = ref<Row[]>()

    // const { api } = useApi()
    // const { project } = useProject()
    // const { $e, $api } = useNuxtApp()
    const { $api } = useNuxtApp()

    const mapMetaData = ref<MapType>({})

    // const geoDataField = ref<string>('')

    // const geoDataFieldColumn = ref<ColumnType | undefined>()

    async function loadMapMeta() {
      if (!viewMeta?.value?.id || !meta?.value?.columns) return
      mapMetaData.value = await $api.dbView.mapRead(viewMeta.value.id)
    }

    async function loadMapData() {
    //   if (!viewMeta?.value?.id || !meta?.value?.columns) return

    //   formattedData.value = []

    //   const res = await api.dbViewRow.list('noco', project.value.id!, meta.value!.id!, viewMeta.value!.id!)

    // //   geoDataFieldColumn.value =
    // //     (meta.value.columns as ColumnType[]).filter((f) => f.id === mapMetaData.value.fk_geo_data_col_id)[0] || {}

    //   geoDataField.value = geoDataFieldColumn!.value!.title!

    // //   const { fk_geo_data_col_id, meta: geo_meta } = mapMetaData.value

    // //   const geoMetaObj: any.value = geo_meta ? JSON.parse(geo_meta as string) : {}

    // //   console.log('column geodata', stackMetaObj.value[fk_geo_data_col_id])
    //   // if ((!project?.value?.id || !meta.value?.id || !viewMeta?.value?.id) && !isPublic.value) return

    //   // reset formattedData & countByStack to avoid storing previous data after changing grouping field

    //   //   alert('in loadMapData')
    //   //   debugger

    //   console.log('res in mapviewdatastore', res)

    //   //   for (const data of res.list) {
    //   //     formattedData.value = data.value
    //   //   }
    //   formattedData.value = res.list
    }

    return {
      formattedData,
      loadMapData,
      loadMapMeta,
      mapMetaData,
    }
  },
)

export { useProvideMapViewStore }

export function useMapViewStoreOrThrow() {
  const mapViewStore = useMapViewStore()

  if (mapViewStore == null) throw new Error('Please call `useProvideMapViewStore` on the appropriate parent component')

  return mapViewStore
}

// async function loadMapData() {
//     if ((!project?.value?.id || !meta.value?.id || !viewMeta?.value?.id) && !isPublic.value) return

//     // reset formattedData & countByStack to avoid storing previous data after changing grouping field
//     formattedData.value = new Map<string | null, Row[]>()
//     countByStack.value = new Map<string | null, number>()

//     let res

//     if (isPublic.value) {
//       res = await fetchSharedViewGroupedData(groupingFieldColumn!.value!.id!)
//     } else {
//       res = await api.dbViewRow.groupedDataList(
//         'noco',
//         project.value.id!,
//         meta.value!.id!,
//         viewMeta.value!.id!,
//         groupingFieldColumn!.value!.id!,
//         {},
//         {},
//       )
//     }

//     for (const data of res) {
//       const key = data.key
//       formattedData.value.set(key, formatData(data.value.list))
//       countByStack.value.set(key, data.value.pageInfo.totalRows || 0)
//     }
//   }
