<script lang="ts" setup>
import 'leaflet/dist/leaflet.css'
import * as L from 'leaflet'
// import { ViewTypes } from '~~/../nocodb-sdk/build/main'
import { ViewTypes } from 'nocodb-sdk'
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

// const { loadData, formattedData: data } = useViewData(meta, view)
const { formattedData, loadMapData } = useMapViewStoreOrThrow()

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

watch(formattedData, () => {
  formattedData.value?.forEach((row) => {
    // const [lat, long] =
    console.log('row', row)
    const [lat, long] = row?.['geo'].split(';').map(parseFloat)
    console.log('lat', lat)
    addMarker(lat, long)
  })
})

const markerRef = ref()
const myMapRef = ref()
// const latitude = formattedData.value
// const longitude = ref()
const markersRef = ref()

reloadViewDataHook?.on(async () => {
  loadMapData()
})

function addMarker(lat: number, long: number) {
  const markerNew = markerRef.value([lat, long])
  console.log(markersRef.value)
  markersRef.value.addLayer(markerNew)

  myMapRef.value.addLayer(markersRef.value)
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
    {{ JSON.stringify(formattedData) }}
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
