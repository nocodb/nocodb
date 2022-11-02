<script lang="ts" setup>
import 'leaflet/dist/leaflet.css'
import * as L from 'leaflet'
// import { ViewTypes } from '~~/../nocodb-sdk/build/main'
// import { ViewTypes } from 'nocodb-sdk'
import { IsFormInj, IsGalleryInj, IsGridInj, IsMapInj, ReadonlyInj, onMounted, provide, ref, useUIPermission } from '#imports'

const { isUIAllowed } = useUIPermission()

provide(IsFormInj, ref(false))
provide(IsGalleryInj, ref(false))
provide(IsGridInj, ref(false))
provide(IsMapInj, ref(true))
provide(ReadonlyInj, !isUIAllowed('xcDatatableEditable'))
const reloadViewDataHook = inject(ReloadViewDataHookInj)

// const meta = inject(MetaInj, ref())
// const view = inject(ActiveViewInj, ref())

const view = inject(ActiveViewInj, ref())
const meta = inject(MetaInj, ref())
const { formattedData, loadMapData, mapData } = useMapViewStoreOrThrow()

// const { loadData, formattedData: data } = useViewData(meta, view)
// const { sharedView, sorts, nestedFilters } = useSharedView()

const {
  showSystemFields,
  // sortedAndFilteredFields,
  fields,
  filteredFieldList,
  // filterQuery,
  showAll,
  // hideAll,
  // saveOrUpdate,
  // metaColumnById,
} = useViewColumns(view, meta)

console.log('fields.value', fields.value)
console.log('showSystemFields.value', showSystemFields.value)
console.log('filteredFieldList.value', filteredFieldList.value)
console.log('showAll.value', showAll.value)
console.log('fields.value', fields.value)

const markerRef = ref()
const myMapRef = ref()
// const latitude = formattedData.value
// const longitude = ref()
const markersRef = ref<L.MarkerClusterGroup | undefined>()

// watch(view, async (nextView) => {
//   if (nextView?.type === ViewTypes.MAP) {
//     // loadData()
//     console.log('change')
//     alert('JO')
//   }
// })

// const { isUIAllowed } = useUIPermission()

onMounted(async () => {
  await loadMapData()
  // const geodata = data.value[0].row.geo.split(';')
})

// const geoDataColumn: any = $(
//   computed(() =>
//     meta.value?.columnsById
//       ? meta.value.columnsById[mapData?.value?.fk_geo_data_col_id as keyof typeof meta.value.columnsById]
//       : {},
//   ),
// )

watch(formattedData, () => {
  markersRef.value?.clearLayers()
  console.log('mapData', mapData?.value?.fk_geo_data_col_id)
  formattedData.value?.forEach((row) => {
    // const [lat, long] =
    console.log('meta', meta?.value?.columns)
    console.log('row', row)
    if (row?.geonew == null) return

    const [lat, long] = row?.geonew.split(';').map(parseFloat)
    if (lat == null || long == null) {
      return
    }
    console.log('lat', lat)
    addMarker(lat, long)

    const selected = row?.rowMeta?.selected
    console.log(selected)
  })
})

reloadViewDataHook?.on(async () => {
  loadMapData()
})

function addMarker(lat: number, long: number) {
  // markersRef.value?.clearLayers()
  const markerNew = markerRef?.value?.([lat, long])
  console.log(markersRef.value)
  markersRef?.value?.addLayer(markerNew)

  myMapRef?.value?.addLayer(markersRef.value)
}

onMounted(async () => {
  const { map, tileLayer, marker } = await import('leaflet')
  await import('leaflet.markercluster')
  const myMap = map('map').setView([51.505, -0.09], 13)
  markerRef.value = marker
  myMapRef.value = myMap
  console.log('markerClusterGroup', L.markerClusterGroup)
  markersRef.value = L.markerClusterGroup()

  tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(myMap)
})

// const geodata = data.value[0].row.geo.split(';')
</script>

<template>
  <div class="flex flex-col h-full w-full">
    {{ JSON.stringify(mapData1) }}
    <!-- {{ JSON.stringify(selected) }} -->
    <!-- {{ JSON.stringify(meta?.columns) }} -->
    <!-- <div class="flex m-4 gap-4">
      <label :for="latitude">latitude</label>
      <input v-model="latitude" />
      <label :for="longitude">longitude</label>
      <input v-model="longitude" />
      <button class="bg-blue" @click="addMarker">Submit</button>
    </div> -->
    <client-only placeholder="Loading...">
      <div class="nounderline" id="map"></div>
    </client-only>
  </div>
</template>

<style scoped>
#map {
  height: 100vh;
}
.nounderline {
  text-decoration: none;
}
</style>
