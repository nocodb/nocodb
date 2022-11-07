<script lang="ts" setup>
import 'leaflet/dist/leaflet.css'
import * as L from 'leaflet'
import { IsGalleryInj, IsGridInj, IsMapInj, onMounted, provide, ref } from '#imports'
import { rowProps } from 'ant-design-vue/lib/grid/Row'

provide(IsGalleryInj, ref(false))
provide(IsGridInj, ref(false))
provide(IsMapInj, ref(true))
const reloadViewDataHook = inject(ReloadViewDataHookInj)
const { formattedData, loadMapData, loadMapMeta, mapMetaData, geoDataFieldColumn } = useMapViewStoreOrThrow()

const markerRef = ref()
const myMapRef = ref()
const markersRef = ref<L.MarkerClusterGroup | undefined>()

onBeforeMount(async () => {
  await loadMapMeta()
  await loadMapData()
})

watch([formattedData, mapMetaData], () => {
  markersRef.value?.clearLayers()

  formattedData.value?.forEach((row) => {
    const primaryGeoDataColumnTitle = geoDataFieldColumn.value?.title

    if (primaryGeoDataColumnTitle == null) {
      throw new Error('Cannot find primary geo data column title')
    }

    console.log('primaryGeoDataColumnTitle', primaryGeoDataColumnTitle)

    const primaryGeoDataValue = row[primaryGeoDataColumnTitle]
    console.log('primaryGeoDataValue', primaryGeoDataValue)

    const [lat, long] = primaryGeoDataValue.split(';').map(parseFloat)

    addMarker(lat, long)
    addMarker(51, 0)
  })
})

reloadViewDataHook?.on(async () => {
  loadMapData()
})

function addMarker(lat: number, long: number, popupContent: string) {
  const markerNew = markerRef?.value?.([lat, long])
  // markerNew.bindPopup('I am a popup').openPopup()

  markersRef?.value?.addLayer(markerNew)

  myMapRef?.value?.addLayer(markersRef.value)

  if (markerNew) {
    markerNew.bindPopup(popupContent)
  }
  return markerNew
}

// function addPopup(marker: any) {
//   marker.bindPopup('I am a popup').openPopup()
// }

watch([formattedData, mapMetaData], () => {
  markersRef.value?.clearLayers()

  formattedData.value?.forEach((row) => {
    const primaryGeoDataColumnTitle = geoDataFieldColumn.value?.title

    if (primaryGeoDataColumnTitle == null) {
      throw new Error('Cannot find primary geo data column title')
    }

    console.log('primaryGeoDataColumnTitle', primaryGeoDataColumnTitle)

    const primaryGeoDataValue = row[primaryGeoDataColumnTitle]

    // const entries = Object.entries(row[0])
    // const keys = Object.keys(row)
    // let text = ''
    // keys.forEach((key, index) => {
    //   text += `<b>${key}</b><br>${row[key]}`
    // })

    // console.log('text', text)
    // for (let i = 0; i < size; i++) {
    //   return row.
    // }
    // const dataForPopup = row.toString()
    console.log('primaryGeoDataValue', primaryGeoDataValue)

    // const FOO = Object.keys(row)

    const listItems = Object.entries(row)
      .map(([key, val]) => {
        console.log('key', key)
        console.log('val', val)
        console.log('----------')
        return `<li><b>${key}</b>: ${val}</li>`
      })
      .join('')

    const popupContent = `<ul>${listItems}</ul>`
    console.log('FOO', popupContent)

    const [lat, long] = primaryGeoDataValue.split(';').map(parseFloat)

    console.log('lat', lat)
    console.log('long', long)

    addMarker(lat, long, popupContent)

    // const marker = addMarker(lat, long)
    // addPopup(marker)
  })
})

onMounted(async () => {
  const { map, tileLayer, marker } = await import('leaflet')
  await import('leaflet.markercluster')
  const myMap = map('map').setView([51.505, -0.09], 13)
  markerRef.value = marker
  myMapRef.value = myMap
  markersRef.value = L.markerClusterGroup()

  tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 5,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(myMap)
})
</script>

<template>
  {{ JSON.stringify(formattedData) }}
  <div class="flex flex-col h-full w-full">
    <client-only placeholder="Loading...">
      <div class="nounderline" id="map"></div>
    </client-only>
  </div>
</template>

<style scoped>
#map {
  height: 100vh;
}
.nounderline a {
  text-decoration: none;
}
</style>
