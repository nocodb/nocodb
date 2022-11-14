<script lang="ts" setup>
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import 'leaflet.markercluster'
import { IsGalleryInj, IsGridInj, IsMapInj, onMounted, provide, ref } from '#imports'

provide(IsGalleryInj, ref(false))
provide(IsGridInj, ref(false))
provide(IsMapInj, ref(true))
const reloadViewDataHook = inject(ReloadViewDataHookInj)
const { formattedData, loadMapData, loadMapMeta, mapMetaData, geoDataFieldColumn } = useMapViewStoreOrThrow()

const markersClusterGroupRef = ref<L.MarkerClusterGroup>()
const mapContainerRef = ref<HTMLElement>()

onBeforeMount(async () => {
  await loadMapMeta()
  await loadMapData()
})

reloadViewDataHook?.on(async () => {
  loadMapData()
  loadMapMeta()
})

function addMarker(lat: number, long: number, popupContent: string) {
  if (markersClusterGroupRef.value == null) {
    throw new Error('Map is null')
  }
  const newMarker = L.marker([lat, long])
  markersClusterGroupRef.value?.addLayer(newMarker)

  if (newMarker) {
    newMarker.bindPopup(popupContent)
  }
}

watch([formattedData, mapMetaData, markersClusterGroupRef], () => {
  if (markersClusterGroupRef.value == null) {
    return
  }

  markersClusterGroupRef.value?.clearLayers()

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
  const myMap = L.map(mapContainerRef.value!).setView([51.505, -0.09], 13)

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 10,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(myMap)

  markersClusterGroupRef.value = L.markerClusterGroup({
    iconCreateFunction(cluster) {
      return L.divIcon({ html: `${cluster.getChildCount()}`, className: 'geo-map-marker-cluster', iconSize: new L.Point(40, 40) })
    },
  })
  myMap.addLayer(markersClusterGroupRef.value)
})
</script>

<template>
  <div class="flex flex-col h-full w-full no-underline">
    <div id="mapContainer" ref="mapContainerRef"></div>
  </div>
</template>

<style scoped lang="scss">
#mapContainer {
  height: 100vh;
}

:global(.geo-map-marker-cluster) {
  background-color: pink;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>

<style>
.no-underline a {
  text-decoration: none !important;
}
</style>
