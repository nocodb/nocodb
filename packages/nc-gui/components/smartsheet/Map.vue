<script lang="ts" setup>
import 'leaflet/dist/leaflet.css'
import L, { LatLng } from 'leaflet'
import 'leaflet.markercluster'
import { ViewTypes } from 'nocodb-sdk'
// import contextmenu from 'vue3-contextmenu'
// import 'vue3-contextmenu/dist/vue3-contextmenu.css'
import { IsGalleryInj, IsGridInj, IsMapInj, OpenNewRecordFormHookInj, onMounted, provide, ref } from '#imports'

import type { Row as RowType } from '~/lib'

provide(IsGalleryInj, ref(false))
provide(IsGridInj, ref(false))
provide(IsMapInj, ref(true))
const route = useRoute()
const router = useRouter()
const reloadViewDataHook = inject(ReloadViewDataHookInj)
const reloadViewMetaHook = inject(ReloadViewMetaHookInj)
const { formattedData, loadMapData, loadMapMeta, mapMetaData, geoDataFieldColumn, addEmptyRow, syncCount, paginationData } =
  useMapViewStoreOrThrow()

const markersClusterGroupRef = ref<L.MarkerClusterGroup>()
const mapContainerRef = ref<HTMLElement>()
const myMapRef = ref<L.Map>()

const meta = inject(MetaInj, ref())
const view = inject(ActiveViewInj, ref())
const openNewRecordFormHook = inject(OpenNewRecordFormHookInj, createEventHook())

const expandedFormDlg = ref(false)
const expandedFormRow = ref<RowType>()
const expandedFormRowState = ref<Record<string, any>>()
const expandedFormClickedLatLongForNewRow = ref<[number, number]>()

const fallBackCenterLocation = {
  lat: 51,
  lng: 0.0,
}

const getMapZoomLocalStorageKey = (viewId: string) => {
  return `mapView.zoom.${viewId}`
}
const getMapCenterLocalStorageKey = (viewId: string) => `mapView.center.${viewId}`

const expandForm = (row: RowType, state?: Record<string, any>, clickedLatLongForNewRow?: [number, number]) => {
  const rowId = extractPkFromRow(row.row, meta.value!.columns!)
  if (rowId) {
    router.push({
      query: {
        ...route.query,
        rowId,
      },
    })
  } else {
    expandedFormClickedLatLongForNewRow.value = clickedLatLongForNewRow
    expandedFormRow.value = row
    expandedFormRowState.value = state
    expandedFormDlg.value = true

    // const lat = state?.lat
    // const lng = state?.lng
  }
}

openNewRecordFormHook?.on(async () => {
  const newRow = await addEmptyRow()
  expandForm(newRow)
})

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

const addMarker = (lat: number, long: number, row: RowType, popupContent: string) => {
  if (markersClusterGroupRef.value == null) {
    throw new Error('Map is null')
  }
  const newMarker = L.marker([lat, long]).on('click', () => {
    expandForm(row)
  })
  markersClusterGroupRef.value?.addLayer(newMarker)

  if (newMarker) {
    newMarker.bindTooltip(popupContent)
  }
}

const resetZoomAndCenterBasedOnLocalStorage = () => {
  if (mapMetaData?.value?.fk_view_id == null) {
    return
  }
  const initialZoomLevel = parseInt(localStorage.getItem(getMapZoomLocalStorageKey(mapMetaData.value.fk_view_id)) || '10')

  const initialCenterLocalStorageStr = localStorage.getItem(getMapCenterLocalStorageKey(mapMetaData.value.fk_view_id))
  const initialCenter = initialCenterLocalStorageStr ? JSON.parse(initialCenterLocalStorageStr) : fallBackCenterLocation

  myMapRef?.value?.setView([initialCenter.lat, initialCenter.lng], initialZoomLevel)
}

onBeforeMount(async () => {
  await loadMapMeta()
  await loadMapData()
})

onMounted(async () => {
  const myMap = L.map(mapContainerRef.value!, {
    center: new LatLng(10, 10),
    zoom: 2,
  })

  myMapRef.value = myMap

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
    if (localStorage != null && mapMetaData?.value?.fk_view_id) {
      localStorage.setItem(getMapZoomLocalStorageKey(mapMetaData.value.fk_view_id), myMap.getZoom().toString())
    }
  })
  myMap.on('moveend', function () {
    if (localStorage != null && mapMetaData?.value?.fk_view_id) {
      localStorage.setItem(getMapCenterLocalStorageKey(mapMetaData?.value?.fk_view_id), JSON.stringify(myMap.getCenter()))
    }
  })

  myMap.on('contextmenu', async function (e) {
    const lat = e.latlng.lat
    const lng = e.latlng.lng
    const newRow = await addEmptyRow()
    if (geoDataFieldColumn.value?.title) {
      newRow.row[geoDataFieldColumn.value.title] = `${lat.toFixed(7)};${lng.toFixed(7)}`
    }
    expandForm(newRow, [lat, lng])
  })
})

reloadViewMetaHook?.on(async () => {
  await loadMapMeta()
})

reloadViewDataHook?.on(async () => {
  await loadMapData()
})

provide(ReloadRowDataHookInj, reloadViewDataHook)

watch([formattedData, mapMetaData, markersClusterGroupRef], () => {
  if (formattedData.value == null || mapMetaData.value?.fk_view_id == null || markersClusterGroupRef.value == null) {
    return
  }

  resetZoomAndCenterBasedOnLocalStorage()

  markersClusterGroupRef.value?.clearLayers()

  formattedData.value?.forEach((row) => {
    const primaryGeoDataColumnTitle = geoDataFieldColumn.value?.title

    if (primaryGeoDataColumnTitle == null) {
      throw new Error('Cannot find primary geo data column title')
    }

    const primaryGeoDataValue = row.row[primaryGeoDataColumnTitle]

    if (primaryGeoDataValue == null) {
      return
    }

    const listItems = Object.entries(row.row)
      .map(([key, val]) => {
        const prettyVal = val !== null && (typeof val === 'object' || Array.isArray(val)) ? JSON.stringify(val) : val
        return `<li><b>${key}</b>: <br/>${prettyVal}</li>`
      })
      .join('')

    const popupContent = `<ul>${listItems}</ul>`

    const [lat, long] = primaryGeoDataValue.split(';').map(parseFloat)

    addMarker(lat, long, row, popupContent)
  })
  syncCount()
})

watch(view, async (nextView) => {
  if (nextView?.type === ViewTypes.MAP) {
    await loadMapMeta()
    await loadMapData()
  }
})

const expandedFormDlgInitialGeoPositionData = computed(() => ({
  lat: expandedFormClickedLatLongForNewRow.value?.[0],
  long: expandedFormClickedLatLongForNewRow.value?.[1],
  geoColId: geoDataFieldColumn.value?.id,
}))

const count = computed(() => paginationData.value.totalRows)
</script>

<template>
  <div class="flex flex-col h-full w-full no-underline">
    <div id="mapContainer" ref="mapContainerRef">
      <a-tooltip placement="bottom" class="tooltip">
        <template #title>
          <span v-if="count > 1000"> You're over the limit. </span>
          <span v-else> You're getting close to the limit. </span>
          <span> The limit of markers shown in a Map View is 1000 records. </span>
        </template>

        <div v-if="count > 900" class="nc-warning-info flex min-w-32px h-32px items-center gap-1 px-2 bg-white">
          <div>{{ count }} records</div>
          <mdi-map-marker-alert />
        </div>
      </a-tooltip>
    </div>
  </div>

  <Suspense>
    <LazySmartsheetExpandedForm
      v-if="expandedFormRow && expandedFormDlg"
      v-model="expandedFormDlg"
      :row="expandedFormRow"
      :state="expandedFormRowState"
      :meta="meta"
      :view="view"
      :initial-geo-position-data="expandedFormDlgInitialGeoPositionData"
    />
  </Suspense>

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
.tooltip {
  height: 2rem;
  max-width: fit-content;
  position: absolute;
  top: 10px;
  right: 10px;
  padding: 10px;
  z-index: 500;
  cursor: default;
}
</style>
