<script lang="ts" setup>
import 'leaflet/dist/leaflet.css'
// import type { MarkerClusterGroup } from 'leaflet'
import L from 'leaflet'
import { IsGalleryInj, IsGridInj, IsMapInj, onMounted, provide, ref } from '#imports'
// import * as L from 'leaflet'
// const { map, tileLayer, marker, markerClusterGroup } = await import('leaflet')
// await import('leaflet.markercluster')

provide(IsGalleryInj, ref(false))
provide(IsGridInj, ref(false))
provide(IsMapInj, ref(true))
const reloadViewDataHook = inject(ReloadViewDataHookInj)
// const { formattedData, loadMapData, loadMapMeta, mapMetaData, geoDataFieldColumn } = useMapViewStoreOrThrow()
const { formattedData, loadMapData, loadMapMeta, mapMetaData, geoDataFieldColumn } = useMapViewStoreOrThrow()

// const markerRef = ref()
const myMapRef = ref<L.Map>()
const layerGroupRef = ref<L.LayerGroup>()
// const markersRef = ref<MarkerClusterGroup | undefined>()
const mapContainerRef = ref<HTMLElement>()

onBeforeMount(async () => {
  await loadMapMeta()
  await loadMapData()
})

reloadViewDataHook?.on(async () => {
  loadMapData()
  loadMapMeta()
})

watchEffect(() => {
  if (mapContainerRef.value) {
    console.log('NOW')
  } else {
    // not mounted yet, or the element was unmounted (e.g. by v-if)
  }
})

function addMarker(lat: number, long: number, popupContent: string) {
  if (myMapRef.value == null) {
    throw new Error('Map is null')
  }
  const newMarker = L.marker([lat, long]).addTo(myMapRef.value)

  if (newMarker) {
    newMarker.bindPopup(popupContent)
  }

  console.log('myMapRef.value', myMapRef.value)
  // const markerNew = markerRef?.value?.([lat, long])

  // L.marker([50, 14]).addTo();

  // markersRef?.value?.addLayer(markerNew)

  // myMapRef?.value?.addLayer(markerRef.value)

  // return markerNew
}

watch([formattedData, mapMetaData, myMapRef], () => {
  // markersRef.value?.clearLayers()

  if (myMapRef.value == null) {
    return
  }

  layerGroupRef.value?.clearLayers()

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
  // if (process.client) {
  // const myMap = L.map('mapContainer').setView([51.505, -0.09], 13)
  // if (mapContainerRef.value != null) {
  console.log('mapContainerRef.value', mapContainerRef.value)
  const myMap = L.map(mapContainerRef.value!).setView([51.505, -0.09], 13)

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 10,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(myMap)

  layerGroupRef.value = L.layerGroup().addTo(myMap)

  // markerRef.value = L.marker
  myMapRef.value = myMap
  // markersRef.value = L.markerClusterGroup()
  // addMarker(52, 0, 'jdksauwdk')
  //   {
  //   iconCreateFunction(cluster) {
  //     return L.divIcon({ html: `<b>${cluster.getChildCount()}</b>` })
  //     // return L.divIcon({ html: `<b>${cluster.getChildCount()}</b>`, className: 'FOOBAR' })
  //   },
  // }
  // )
  // }
  // }
})
</script>

<template>
  <div class="flex flex-col h-full w-full nounderline">
    <!-- <client-only placeholder="Loading..."> -->
    <div id="mapContainer" ref="mapContainerRef" class="FOOBAR"></div>
    <!-- </client-only> -->
  </div>
</template>

<style scoped>
#mapContainer {
  height: 100vh;
}
.nounderline {
  text-decoration: none;
}

/* .marker-cluster b {
  background-color: rgba(226, 36, 36, 0.6);
} */

/* .FOOBAR {
  background-color: pink;
} */
</style>
