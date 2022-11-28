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

const getMapZoomLocalStorageKey = (mapMetaData: { value: { fk_view_id: string } }) => {
  console.log('mapMetaData.value.fk_view_id', mapMetaData.value.fk_view_id)
  debugger
  return `mapView.zoom.${mapMetaData.value.fk_view_id}`
}
const getMapCenterLocalStorageKey = (mapMetaData: { value: { fk_view_id: string } }) =>
  `mapView.center.${mapMetaData.value.fk_view_id}`

const expandForm = (row: RowType, state?: Record<string, any>) => {
  console.log('expandForm')
  const rowId = extractPkFromRow(row.row, meta.value!.columns!)

  // debugger

  if (rowId) {
    console.log('if')
    router.push({
      query: {
        ...route.query,
        rowId,
      },
    })
  } else {
    console.log('else')
    expandedFormRow.value = row
    expandedFormRowState.value = state
    expandedFormDlg.value = true
  }
}

const expandedFormOnRowIdDlg = computed({
  get() {
    return !!route.query.rowId
  },
  set(val) {
    if (!val)
      router.push({
        query: {
          ...route.query,
          rowId: undefined,
        },
      })
  },
})

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
    console.log('click on marker')
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

const resetZoomAndCenterBasedOnLocalStorage = () => {
  const initialZoomLevel = parseInt(localStorage.getItem(getMapZoomLocalStorageKey(mapMetaData)) || '10')

  const initialCenterLocalStorageStr = localStorage.getItem(getMapCenterLocalStorageKey(mapMetaData))
  const initialCenter = initialCenterLocalStorageStr
    ? JSON.parse(initialCenterLocalStorageStr)
    : {
        lat: 0.0,
        lng: 0.0,
      }

  console.log('myMapRef?.value?.setView', myMapRef?.value?.setView)
  console.log('initialCenter', initialCenter)
  console.log('initialZoomLevel', initialZoomLevel)
  alert('HI')

  myMapRef?.value?.setView([initialCenter.lat, initialCenter.lng], initialZoomLevel)
}

onRenderTriggered(async () => {
  resetZoomAndCenterBasedOnLocalStorage()
})

onMounted(async () => {
  const myMap = L.map(mapContainerRef.value!)

  myMapRef.value = myMap

  resetZoomAndCenterBasedOnLocalStorage()

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(myMap)

  markersClusterGroupRef.value = L.markerClusterGroup({
    iconCreateFunction(cluster: { getChildCount: () => number }) {
      return L.divIcon({ html: `${cluster.getChildCount()}`, className: 'geo-map-marker-cluster', iconSize: new L.Point(40, 40) })
    },
  })
  myMap.addLayer(markersClusterGroupRef.value)

  myMap.on('zoomend', function () {
    if (localStorage != null) {
      localStorage.setItem(getMapZoomLocalStorageKey(mapMetaData), myMap.getZoom().toString())
    }
  })
  myMap.on('moveend', function () {
    if (localStorage != null) {
      localStorage.setItem(getMapCenterLocalStorageKey(mapMetaData), JSON.stringify(myMap.getCenter()))
    }
  })
})
</script>

<template>
  <div class="flex flex-col h-full w-full no-underline">
    <div id="mapContainer" ref="mapContainerRef"></div>
  </div>

  <Suspense>
    <LazySmartsheetExpandedForm
      v-if="expandedFormOnRowIdDlg"
      :key="route.query.rowId"
      v-model="expandedFormOnRowIdDlg"
      :row="{ row: {}, oldRow: {}, rowMeta: {} }"
      :meta="meta"
      :row-id="route.query.rowId"
      :view="view"
    />
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
