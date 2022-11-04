<script lang="ts" setup>
import 'leaflet/dist/leaflet.css'
import * as L from 'leaflet'
// import { ViewTypes } from '~~/../nocodb-sdk/build/main'
// import { ViewTypes } from 'nocodb-sdk'
// import { IsFormInj, IsGalleryInj, IsGridInj, IsMapInj, ReadonlyInj, onMounted, provide, ref, useUIPermission } from '#imports'
import { IsGalleryInj, IsGridInj, IsMapInj, onMounted, provide, ref } from '#imports'
import type { Row } from '~/lib'

// const { isUIAllowed } = useUIPermission()

// provide(IsFormInj, ref(false))
provide(IsGalleryInj, ref(false))
provide(IsGridInj, ref(false))
provide(IsMapInj, ref(true))
// provide(ReadonlyInj, !isUIAllowed('xcDatatableEditable'))

// const meta = inject(MetaInj, ref())
// const view = inject(ActiveViewInj, ref())

// const view = inject(ActiveViewInj, ref())
// const meta = inject(MetaInj, ref())
const reloadViewDataHook = inject(ReloadViewDataHookInj)

// const reloadViewMetaHook = inject(ReloadViewMetaHookInj)
const { formattedData, loadMapData, loadMapMeta, mapMetaData, geoDataFieldColumn } = useMapViewStoreOrThrow()
// const {
//   showSystemFields,
//   // sortedAndFilteredFields,
//   fields,
//   filteredFieldList,
//   // filterQuery,
//   showAll,
//   // hideAll,
//   // saveOrUpdate,
//   // metaColumnById,
// } = useViewColumns(view, meta)

// console.log('fields.value', fields.value)
// console.log('showSystemFields.value', showSystemFields.value)
// console.log('filteredFieldList.value', filteredFieldList.value)
// console.log('showAll.value', showAll.value)
// console.log('fields.value', fields.value)

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

onBeforeMount(async () => {
  // console.log('onBeforeMount')
  await loadMapMeta()
  await loadMapData()
  // console.log('IN BEFOREMOUNT: geoDataFieldColumn.value.title', geoDataFieldColumn?.value?.title)
  // console.log('on mapview formatted', formattedData)
  // const geodata = data.value[0].row.geo.split(';')
})

// const geoDataColumn: any = $(
//   computed(() =>
//     meta.value?.columnsById
//       ? meta.value.columnsById[mapData?.value?.fk_geo_data_col_id as keyof typeof meta.value.columnsById]
//       : {},
//   ),
// )

const { fk_geo_data_col_id } = mapMetaData.value

console.log('fk_geo_data_col_id', fk_geo_data_col_id)

watch([formattedData, mapMetaData], () => {
  // console.log('WATCH CALL FOR formattedData')
  markersRef.value?.clearLayers()
  // formattedData.get()
  // const rows = Array.from(formattedData.value.values())
  // console.log('rows', rows)

  // console.log('IN WATCHER: geoDataFieldColumn.value', geoDataFieldColumn?.value)

  formattedData.value?.forEach((row) => {
    // const [lat, long] =
    // console.log('meta', meta?.value?.columns)
    console.log('row', row)

    const primaryGeoDataColumnTitle = geoDataFieldColumn.value?.title

    if (primaryGeoDataColumnTitle == null) {
      throw new Error('Cannot find primary geo data column title')
    }

    console.log('primaryGeoDataColumnTitle', primaryGeoDataColumnTitle)

    const primaryGeoDataValue = row[primaryGeoDataColumnTitle]
    console.log('primaryGeoDataValue', primaryGeoDataValue)

    const [lat, long] = primaryGeoDataValue.split(';')

    console.log('lat, long', lat, long)

    addMarker(lat, long)

    // if (geoDataFieldColumn?.value?.title === null) return

    // const [lat, long] = row?.split(';').map(parseFloat)
    // if (lat == null || long == null) {
    //   return
    // }
    // console.log('lat', lat)
    // addMarker(lat, long)

    // const selected = row?.rowMeta?.selected
    // console.log(selected)
  })
})

reloadViewDataHook?.on(async () => {
  loadMapData()
})

function addMarker(lat: number, long: number) {
  const markerNew = markerRef?.value?.([lat, long])
  // console.log(markersRef.value)
  markersRef?.value?.addLayer(markerNew)

  myMapRef?.value?.addLayer(markersRef.value)
}

onMounted(async () => {
  const { map, tileLayer, marker } = await import('leaflet')
  await import('leaflet.markercluster')
  const myMap = map('map').setView([51.505, -0.09], 13)
  markerRef.value = marker
  myMapRef.value = myMap
  // console.log('markerClusterGroup', L.markerClusterGroup)
  markersRef.value = L.markerClusterGroup()

  tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(myMap)

  // addMarker(52, 0)
})

// const geodata = data.value[0].row.geo.split(';')
</script>

<template>
  <div class="flex flex-col h-full w-full">
    {{ JSON.stringify(formattedData) }}
    {{ JSON.stringify(geoDataFieldColumn?.title) }}
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
