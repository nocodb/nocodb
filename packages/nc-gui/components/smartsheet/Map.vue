<script lang="ts" setup>
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import 'leaflet.markercluster'
import { IsGalleryInj, IsGridInj, IsMapInj, onMounted, provide, ref } from '#imports'
import type { Row as RowType } from '~/lib'

const meta = inject(MetaInj, ref())
provide(IsGalleryInj, ref(false))
provide(IsGridInj, ref(false))
provide(IsMapInj, ref(true))
const view = inject(ActiveViewInj, ref())
const reloadViewDataHook = inject(ReloadViewDataHookInj)
const { formattedData, loadMapData, loadMapMeta, mapMetaData, geoDataFieldColumn } = useMapViewStoreOrThrow()

const markersClusterGroupRef = ref<L.MarkerClusterGroup>()
const mapContainerRef = ref<HTMLElement>()
const myMapRef = ref<L.Map>()

const route = useRoute()

const router = useRouter()
const expandedFormDlg = ref(false)
const expandedFormRow = ref<RowType>()
const expandedFormRowState = ref<Record<string, any>>()

console.log('meta', mapMetaData)

onBeforeMount(async () => {
  await loadMapMeta()
  await loadMapData()
})

reloadViewDataHook?.on(async () => {
  loadMapData()
  loadMapMeta()
})

const expandForm = (row: RowType) => {
  const rowId = extractPkFromRow(row.row, meta.value!.columns!)

  if (rowId) {
    router.push({
      query: {
        ...route.query,
        rowId,
      },
    })
  } else {
    expandedFormRow.value = row
    // expandedFormRowState.value = state
    expandedFormDlg.value = true
  }
}

const expandFormClick = async (row: RowType) => {
  expandForm(row)
}

// openNewRecordFormHook?.on(async () => {
//   const newRow = await addEmptyRow()
//   expandForm(newRow)
// })

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

function addMarker(lat: number, long: number, popupContent: string, row: RowType) {
  if (markersClusterGroupRef.value == null) {
    throw new Error('Map is null')
  }
  const onMarkerClick = () => {
    expandFormClick(row)
  }
  const newMarker = L.marker([lat, long]).on('click', onMarkerClick)
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

    addMarker(lat, long, popupContent, row)

    // myMapRef.value?.off('contextmenu', function (e) {
    //   console.log('mapref in watch', e.latlng)
    // })
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

  myMap.on('zoomend', function (_params) {
    const bounds = myMap.getBounds()
    const newS = bounds.getSouthWest()

    // console.log('bounds', newS)
    // console.log('params', params)

    if (localStorage != null) {
      // TODO: use current mapView id as suffix to the local storage key,
      // so there are no clashes when there are multiple map views, e.g.:
      // localStorage.setItem(`mapView.${meta?.value.id || 'DEFAULT_ID'}`, this.input)
      localStorage.setItem(`mapView.zoom${mapMetaData.value.fk_view_id}`, myMap.getZoom().toString())
    }
  })

  // const bounds = myMap.getBounds()
  // console.log(bounds)
})
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
