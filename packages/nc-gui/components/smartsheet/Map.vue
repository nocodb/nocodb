<script lang="ts" setup>
import 'leaflet/dist/leaflet.css'
import L, { LatLng } from 'leaflet'
import 'leaflet.markercluster'
import { ViewTypes } from 'nocodb-sdk'
import { IsGalleryInj, IsGridInj, IsMapInj, onMounted, provide, ref } from '#imports'

import type { Row as RowType } from '~/lib'

// const props = defineProps<Props>()
// const emits = defineEmits<Emits>()
provide(IsGalleryInj, ref(false))
provide(IsGridInj, ref(false))
provide(IsMapInj, ref(true))
const route = useRoute()
const router = useRouter()
const reloadViewDataHook = inject(ReloadViewDataHookInj)
// const openNewRecordFormHook = inject(OpenNewRecordFormHookInj, createEventHook())
const { formattedData, loadMapData, loadMapMeta, mapMetaData, geoDataFieldColumn, insertRow } = useMapViewStoreOrThrow()

const markersClusterGroupRef = ref<L.MarkerClusterGroup>()
const mapContainerRef = ref<HTMLElement>()
const myMapRef = ref<L.Map>()
// const submitted = ref(false)

const meta = inject(MetaInj, ref())
const view = inject(ActiveViewInj, ref())

const expandedFormDlg = ref(false)
const expandedFormRow = ref<RowType>()
const expandedFormRowState = ref<Record<string, any>>()

// const formState = reactive({})

// const { syncLTARRefs, row } = useProvideSmartsheetRowStore(
//   meta,
//   ref({
//     row: formState,
//     oldRow: {},
//     rowMeta: { new: true },
//   }),
// )

// async function submitForm() {
//   const insertedRowData = await insertRow({ row: formState, oldRow: {}, rowMeta: { new: true } })

//   if (insertedRowData) {
//     await syncLTARRefs(insertedRowData)
//   }
//   console.log('onsubmitForm')
//   submitted.value = true
// }

// interface Props {
//   // modelValue?: GeoLocationType | null
//   modelValue?: string | null
// }

// interface Emits {
//   (event: 'update:modelValue', model: GeoLocationType): void
// }

// const vModel = useVModel(props, 'modelValue', emits)

const getMapZoomLocalStorageKey = (viewId: string) => {
  return `mapView.zoom.${viewId}`
}
const getMapCenterLocalStorageKey = (viewId: string) => `mapView.center.${viewId}`

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
  })
  markersClusterGroupRef.value?.addLayer(newMarker)

  // if (newMarker) {
  //   newMarker.bindPopup(popupContent)
  // }
}

const resetZoomAndCenterBasedOnLocalStorage = () => {
  if (mapMetaData?.value?.fk_view_id == null) {
    console.error('Early leaving of resetZoomAndCenterBasedOnLocalStorage because "mapMetaData?.value?.fk_view_id == null"')
    console.log('mapMetaData?.value', mapMetaData?.value)
    return
  }
  const initialZoomLevel = parseInt(localStorage.getItem(getMapZoomLocalStorageKey(mapMetaData.value.fk_view_id)) || '10')

  const initialCenterLocalStorageStr = localStorage.getItem(getMapCenterLocalStorageKey(mapMetaData.value.fk_view_id))
  const initialCenter = initialCenterLocalStorageStr
    ? JSON.parse(initialCenterLocalStorageStr)
    : {
        lat: 51,
        lng: 0.0,
      }

  myMapRef?.value?.setView([initialCenter.lat, initialCenter.lng], initialZoomLevel)
}

watch([formattedData, mapMetaData, markersClusterGroupRef], () => {
  console.log('CALL OF watch([formattedData, mapMetaData, markersClusterGroupRef]) handler')
  // console.log('formattedData.value', formattedData.value)
  // console.log('mapMetaData.value', mapMetaData.value)
  // console.log('markersClusterGroupRef.value', markersClusterGroupRef.value)

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
    // const newRow = await addEmptyRow()
    const lat = e.latlng.lat
    const lng = e.latlng.lng
    addMarker(lat, lng, newRow)
    expandForm(newRow)
    // submitForm()
  })
})

watch(view, async (nextView) => {
  if (nextView?.type === ViewTypes.MAP) {
    await loadMapMeta()
    await loadMapData()
    // await resetZoomAndCenterBasedOnLocalStorage()
  }
})

// openNewRecordFormHook?.on(async () => {
//   const newRow = await addEmptyRow()
//   expandForm(newRow)
// })
</script>

<template>
  <div class="flex flex-col h-full w-full no-underline">
    <div id="mapContainer" ref="mapContainerRef"></div>
  </div>

  <Suspense>
    <LazySmartsheetExpandedForm
      v-if="expandedFormRow && expandedFormDlg"
      v-model="expandedFormDlg"
      :row="expandedFormRow"
      :state="expandedFormRowState"
      :meta="meta"
      :view="view"
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
</style>
