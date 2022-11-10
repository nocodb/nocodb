<script lang="ts" setup>
import 'leaflet/dist/leaflet.css'
import * as L from 'leaflet'
import { IsGalleryInj, IsGridInj, IsMapInj, onMounted, provide, ref } from '#imports'

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

reloadViewDataHook?.on(async () => {
  loadMapData()
  loadMapMeta()
})

function addMarker(lat: number, long: number, popupContent: string) {
  const markerNew = markerRef?.value?.([lat, long])

  markersRef?.value?.addLayer(markerNew)

  myMapRef?.value?.addLayer(markersRef.value)

  if (markerNew) {
    markerNew.bindPopup(popupContent)
  }
  return markerNew
}

watch([formattedData, mapMetaData], () => {
  markersRef.value?.clearLayers()

  formattedData.value?.forEach((row) => {
    const primaryGeoDataColumnTitle = geoDataFieldColumn.value?.title

    if (primaryGeoDataColumnTitle == null) {
      throw new Error('Cannot find primary geo data column title')
    }

    const primaryGeoDataValue = row[primaryGeoDataColumnTitle]

    const listItems = Object.entries(row)
      .map(([key, val]) => {
        const prettyVal = val !== null && (typeof val === 'object' || Array.isArray(val)) ? JSON.stringify(val) : val

        return `<li><b>${key}</b>: <br/>${prettyVal}</li>`
      })
      .join('')

    const popupContent = `<ul>${listItems}</ul>`

    const [lat, long] = primaryGeoDataValue.split(';').map(parseFloat)

    addMarker(lat, long, popupContent)
  })
})

onMounted(async () => {
  const { map, tileLayer, marker } = await import('leaflet')
  await import('leaflet.markercluster')
  const myMap = map('map').setView([51.505, -0.09], 13)
  markerRef.value = marker
  myMapRef.value = myMap
  markersRef.value = L.markerClusterGroup({
    iconCreateFunction(cluster) {
      return L.divIcon({ html: `<b>${cluster.getChildCount()}</b>` })
      // return L.divIcon({ html: `<b>${cluster.getChildCount()}</b>`, className: 'FOOBAR' })
    },
  })

  tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 10,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(myMap)
})
</script>

<template>
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

.marker-cluster b {
  background-color: rgba(226, 36, 36, 0.6);
}

.FOOBAR {
  background-color: pink;
}
</style>
