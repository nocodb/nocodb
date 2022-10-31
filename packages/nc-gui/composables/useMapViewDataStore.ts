// const { project } = useProject()

const [useProvideMapViewStore, useMapViewStore] = useInjectionState(() => {
  const staticData = ['1', '2']

  return {
    staticData,
  }
})

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
