<script lang="ts" setup>
import 'leaflet/dist/leaflet.css'
import * as L from 'leaflet'
import { IsFormInj, IsGalleryInj, IsGridInj, ReadonlyInj, onMounted, provide, ref, useUIPermission } from '#imports'

const { isUIAllowed } = useUIPermission()

provide(IsFormInj, ref(false))
provide(IsGalleryInj, ref(true))
provide(IsGridInj, ref(false))
provide(ReadonlyInj, !isUIAllowed('xcDatatableEditable'))

const markerRef = ref()
const myMapRef = ref()
const latitude = ref()
const longitude = ref()
const markersRef = ref()

function addMarker() {
  const markerNew = markerRef.value([parseFloat(latitude.value), parseFloat(longitude.value)])
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
</script>

<template>
  <div class="flex flex-col h-full w-full nounderline">
    <div class="flex m-4 gap-4">
      <label :for="latitude">latitude</label>
      <input v-model="latitude" />
      <label :for="longitude">longitude</label>
      <input v-model="longitude" />
      <button class="bg-blue" @click="addMarker">Submit</button>
    </div>
    <client-only placeholder="Loading...">
      <div id="map"></div>
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
