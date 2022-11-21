<script lang="ts" setup>
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import 'leaflet.markercluster'
import { IsGalleryInj, IsGridInj, IsMapInj, onMounted, provide, ref } from '#imports'

import type { Row as RowType } from '~/lib'

provide(IsGalleryInj, ref(false))
provide(IsGridInj, ref(false))
provide(IsMapInj, ref(true))
const route = useRoute()
const router = useRouter()
const reloadViewDataHook = inject(ReloadViewDataHookInj)
const { formattedData, loadMapData, loadMapMeta, mapMetaData, geoDataFieldColumn } = useMapViewStoreOrThrow()

const markersClusterGroupRef = ref<L.MarkerClusterGroup>()
const mapContainerRef = ref<HTMLElement>()
const myMapRef = ref<L.Map>()

const meta = inject(MetaInj, ref())
const view = inject(ActiveViewInj, ref())

const expandedFormDlg = ref(false)
const expandedFormRow = ref<RowType>()
const expandedFormRowState = ref<Record<string, any>>()

console.log('meta', mapMetaData)

const expandForm = (row: RowType, state?: Record<string, any>) => {
  const rowId = extractPkFromRow(row.row, meta.value!.columns!)

  // debugger

  if (rowId) {
    router.push({
      query: {
        ...route.query,
        rowId,
      },
    })
  } else {
    expandedFormRow.value = row
    expandedFormRowState.value = state
    expandedFormDlg.value = true
  }
}

onBeforeMount(async () => {
  await loadMapMeta()
  await loadMapData()
})

reloadViewDataHook?.on(async () => {
  loadMapData()
  loadMapMeta()
})

function addMarker(lat: number, long: number, row: RowType) {
  if (markersClusterGroupRef.value == null) {
    throw new Error('Map is null')
  }
  const newMarker = L.marker([lat, long]).on('click', () => {
    expandForm(row)
  })
  markersClusterGroupRef.value?.addLayer(newMarker)

  // if (newMarker) {
  //   newMarker.bindPopup(popupContent)
  // }
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

    const primaryGeoDataValue = row.row[primaryGeoDataColumnTitle]

    // const listItems = Object.entries(row)
    //   .map(([key, val]) => {
    //     const prettyVal = val !== null && (typeof val === 'object' || Array.isArray(val)) ? JSON.stringify(val) : val

    //     return `<li><b>${key}</b>: <br/>${prettyVal}</li>`
    //   })
    //   .join('')

    // const popupContent = `<ul>${listItems}</ul>`

    if (primaryGeoDataValue == null) {
      return
    }

    const [lat, long] = primaryGeoDataValue.split(';').map(parseFloat)

    addMarker(lat, long, row)
  })
})

onMounted(async () => {
  // TODO: also here add/use viewId suffix approach (see comment below)
  const initialZoomLevel = parseInt(localStorage.getItem(`mapView.zoom${mapMetaData.value.fk_view_id}`) || '10')
  // const initialBounds = parseInt(localStorage.getItem(`mapView.bounds${mapMetaData.value.fk_view_id}`) || '10')
  // myMap.setZoom(initialZoomLevel)

  const myMap = L.map(mapContainerRef.value!).setView([51.505, -0.09], initialZoomLevel)
  myMapRef.value = myMap

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(myMap)

  markersClusterGroupRef.value = L.markerClusterGroup({
    iconCreateFunction(cluster) {
      return L.divIcon({ html: `${cluster.getChildCount()}`, className: 'geo-map-marker-cluster', iconSize: new L.Point(40, 40) })
    },
  })
  myMap.addLayer(markersClusterGroupRef.value)

  myMap.on('zoomend', function (params) {
    const bounds = myMap.getBounds()
    const newS = bounds.getSouthWest()

    console.log('bounds', newS)
    console.log('params', params)

    if (localStorage != null) {
      // TODO: use current mapView id as suffix to the local storage key,
      // so there are no clashes when there are multiple map views, e.g.:
      // localStorage.setItem(`mapView.${meta?.value.id || 'DEFAULT_ID'}`, this.input)
      localStorage.setItem(`mapView.zoom${mapMetaData.value.fk_view_id}`, myMap.getZoom().toString())
    }
  })

  const bounds = myMap.getBounds()
  console.log(bounds)
})
</script>

<template>
  <!-- {{ JSON.stringify(expandedFormDlg) }} -->
  expandedFormRow: {{ JSON.stringify(expandedFormRow) }}
  <br />
  expandedFormRowState: {{ JSON.stringify(expandedFormRowState) }}
  <!-- {{ JSON.stringify(meta) }} -->
  <!-- {{ JSON.stringify(view) }} -->

  <div class="flex flex-col h-full w-full no-underline">
    <div id="mapContainer" ref="mapContainerRef"></div>
  </div>
  <div :style="{ width: '200px', height: '200px', backgroundColor: 'red' }" class="FOO_BAR"></div>

  <Suspense>
    <LazySmartsheetExpandedForm
      v-model="expandedFormDlg"
      :row="expandedFormRow"
      :state="expandedFormRowState"
      :meta="meta"
      :view="view"
    />
    <template #fallback> Loading... </template>
  </Suspense>
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
.leaflet-popup-content-wrapper {
  max-height: 255px;
  overflow: scroll;
}
</style>
