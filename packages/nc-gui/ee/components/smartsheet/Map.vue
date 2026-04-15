<script lang="ts" setup>
import 'leaflet/dist/leaflet.css'
import L, { LatLng } from 'leaflet'
import 'leaflet.markercluster'
import { PermissionEntity, PermissionKey, ViewTypes, latLongToJoinedString } from 'nocodb-sdk'

const route = useRoute()

const { tileUrl, attribution } = useMapConfig()

const fields = inject(FieldsInj, ref([]))

const router = useRouter()

const reloadViewDataHook = inject(ReloadViewDataHookInj)

const { withLoading } = useLoadingTrigger()

const reloadViewMetaHook = inject(ReloadViewMetaHookInj)

const { formattedData, loadMapData, loadMapMeta, mapMetaData, geoDataFieldColumn, addEmptyRow, paginationData } =
  useMapViewStoreOrThrow()

const markersClusterGroupRef = ref<L.MarkerClusterGroup>()

const mapContainerRef = ref<HTMLElement>()

const myMapRef = ref<L.Map>()

const isPublic = inject(IsPublicInj, ref(false))

const { isUIAllowed } = useRoles()

const { isAllowed } = usePermissions()

const { isSyncedTable } = useSmartsheetStoreOrThrow()

const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

const openNewRecordFormHook = inject(OpenNewRecordFormHookInj, createEventHook())

const expandedFormDlg = ref(false)

const expandedFormRow = ref<Row>()

const expandedFormRowState = ref<Record<string, any>>()

const fallBackCenterLocation = {
  lat: 51,
  lng: 0.0,
}

const getMapZoomLocalStorageKey = (viewId: string) => {
  return `mapView.${viewId}.zoom`
}
const getMapCenterLocalStorageKey = (viewId: string) => `mapView.${viewId}.center`

const expandForm = (row: Row, state?: Record<string, any>) => {
  const rowId = extractPkFromRow(row.row, meta.value!.columns!)

  if (rowId && !isPublic.value) {
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

const openNewRecordFormListener = async () => {
  if (
    !isUIAllowed('dataInsert') ||
    isSyncedTable.value ||
    !isAllowed(PermissionEntity.TABLE, meta.value?.id, PermissionKey.TABLE_RECORD_ADD)
  ) {
    return
  }

  const newRow = await addEmptyRow()
  expandForm(newRow)
}

openNewRecordFormHook?.on(openNewRecordFormListener)

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

const MAX_TOOLTIP_FIELDS = 4
const MAX_TOOLTIP_VALUE_LENGTH = 50

const buildTooltipContent = (row: Row, lat: number, long: number): string => {
  const visibleFields = fields.value ?? []
  const geoTitle = geoDataFieldColumn.value?.title

  // Show up to MAX_TOOLTIP_FIELDS visible fields, excluding the geo column itself
  const tooltipFields = visibleFields.filter((f) => f.title !== geoTitle).slice(0, MAX_TOOLTIP_FIELDS)

  if (tooltipFields.length === 0) {
    return `<div class="nc-map-tooltip-content"><span class="nc-map-tooltip-coords">${lat}, ${long}</span></div>`
  }

  const lines = tooltipFields
    .map((f) => {
      const rawValue = row.row[f.title!]
      if (rawValue == null || rawValue === '') return null

      let displayValue = String(rawValue)
      if (displayValue.length > MAX_TOOLTIP_VALUE_LENGTH) {
        displayValue = `${displayValue.substring(0, MAX_TOOLTIP_VALUE_LENGTH)}…`
      }

      // Escape HTML to prevent XSS
      const escapeHtml = (str: string) =>
        str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
      const escaped = escapeHtml(displayValue)
      const label = escapeHtml(f.title ?? '')

      return `<div class="nc-map-tooltip-row"><span class="nc-map-tooltip-label">${label}</span><span class="nc-map-tooltip-value">${escaped}</span></div>`
    })
    .filter(Boolean)
    .join('')

  return `<div class="nc-map-tooltip-content">${lines || `<span class="nc-map-tooltip-coords">${lat}, ${long}</span>`}</div>`
}

const addMarker = (lat: number, long: number, row: Row) => {
  if (markersClusterGroupRef.value == null) {
    return
  }
  const tooltipHtml = buildTooltipContent(row, lat, long)
  const newMarker = L.marker([lat, long], {
    alt: `${lat}, ${long}`,
  })
    .bindTooltip(tooltipHtml, {
      direction: 'top',
      offset: L.point(0, -10),
      opacity: 0.95,
      className: 'nc-map-marker-tooltip',
    })
    .on('click', () => {
      expandForm(row)
    })
  markersClusterGroupRef.value?.addLayer(newMarker)
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

  L.tileLayer(tileUrl.value, {
    maxZoom: 19,
    attribution: attribution.value,
  }).addTo(myMap)

  markersClusterGroupRef.value = L.markerClusterGroup({
    iconCreateFunction(cluster: { getChildCount: () => number }) {
      return L.divIcon({
        html: `${cluster.getChildCount()}`,
        className: 'geo-map-marker-cluster',
        iconSize: new L.Point(40, 40),
      })
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
    if (
      !isUIAllowed('dataInsert') ||
      isSyncedTable.value ||
      !isAllowed(PermissionEntity.TABLE, meta.value?.id, PermissionKey.TABLE_RECORD_ADD)
    ) {
      return
    }

    const { lat, lng } = e.latlng
    const newRow = await addEmptyRow()
    if (geoDataFieldColumn.value?.title) {
      newRow.row[geoDataFieldColumn.value.title] = latLongToJoinedString(lat, lng)
    }
    expandForm(newRow)
  })
})

const reloadViewMetaListener = async () => {
  await loadMapMeta()
}

reloadViewMetaHook?.on(reloadViewMetaListener)

const reloadViewDataListener = withLoading(async () => {
  await loadMapData()
})

reloadViewDataHook?.on(reloadViewDataListener)

onBeforeUnmount(() => {
  openNewRecordFormHook?.off(openNewRecordFormListener)
  reloadViewMetaHook?.off(reloadViewMetaListener)
  reloadViewDataHook?.off(reloadViewDataListener)

  markersClusterGroupRef.value?.clearLayers()
  myMapRef.value?.remove()
  myMapRef.value = undefined
})

provide(ReloadRowDataHookInj, reloadViewDataHook!)

watch([formattedData, mapMetaData, markersClusterGroupRef], () => {
  if (formattedData.value == null || mapMetaData.value?.fk_view_id == null || markersClusterGroupRef.value == null) {
    return
  }

  markersClusterGroupRef.value?.clearLayers()

  const primaryGeoDataColumnTitle = geoDataFieldColumn.value?.title

  // When a view is duplicated or first loading, geoDataFieldColumn may not
  // be populated yet. Return early — the watcher will re-fire once
  // loadMapMeta() completes and geoDataFieldColumn is set.
  if (primaryGeoDataColumnTitle == null) {
    return
  }

  formattedData.value?.forEach((row) => {
    const primaryGeoDataValue = row.row[primaryGeoDataColumnTitle]
    if (primaryGeoDataValue == null) {
      return
    }
    const [lat, long] = primaryGeoDataValue.split(';').map(parseFloat)
    if (isNaN(lat) || isNaN(long) || lat < -90 || lat > 90 || long < -180 || long > 180) {
      return
    }
    addMarker(lat, long, row)
  })

  // Auto-fit map to show all markers, or fall back to saved/default position
  const layers = markersClusterGroupRef.value?.getLayers() ?? []
  if (layers.length > 0) {
    const bounds = markersClusterGroupRef.value!.getBounds()
    myMapRef.value?.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 })
  } else {
    resetZoomAndCenterBasedOnLocalStorage()
  }
})

watch(view, async (nextView) => {
  if (nextView?.type === ViewTypes.MAP) {
    await loadMapMeta()
    await loadMapData()
  }
})

const count = computed(() => paginationData.value.totalRows)

const medianCoordinates = computed(() => {
  const primaryGeoDataColumnTitle = geoDataFieldColumn.value?.title
  if (!primaryGeoDataColumnTitle || !formattedData.value?.length) {
    return null
  }

  const validCoords: { lat: number; lng: number }[] = []
  formattedData.value.forEach((row) => {
    const val = row.row[primaryGeoDataColumnTitle]
    if (val == null) return
    const [lat, lng] = val.split(';').map(parseFloat)
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      validCoords.push({ lat, lng })
    }
  })

  if (validCoords.length === 0) return null

  const sortedLats = validCoords.map((c) => c.lat).sort((a, b) => a - b)
  const sortedLngs = validCoords.map((c) => c.lng).sort((a, b) => a - b)

  const median = (arr: number[]) => {
    const mid = Math.floor(arr.length / 2)
    return arr.length % 2 !== 0 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2
  }

  return { lat: median(sortedLats), lng: median(sortedLngs) }
})

const onAddRecordClick = async () => {
  const newRow = await addEmptyRow()
  if (geoDataFieldColumn.value?.title && medianCoordinates.value) {
    newRow.row[geoDataFieldColumn.value.title] = latLongToJoinedString(medianCoordinates.value.lat, medianCoordinates.value.lng)
  }
  expandForm(newRow)
}
</script>

<template>
  <div class="flex flex-col h-full w-full no-underline" data-testid="nc-map-wrapper">
    <div id="mapContainer" ref="mapContainerRef" role="application" aria-label="Map view" class="w-full nc-h-screen">
      <a-tooltip placement="bottom" class="h-2 w-auto max-w-fit-content absolute top-3 right-3 p-2 z-500 cursor-default">
        <template #title>
          <span v-if="count > 1000"> {{ $t('msg.info.map.overLimit') }} </span>
          <span v-else-if="count > 900"> {{ $t('msg.info.map.closeLimit') }} </span>
          <span> {{ $t('msg.info.map.limitNumber') }} </span>
        </template>

        <div
          v-if="count > 900"
          role="alert"
          class="nc-warning-info flex min-w-32px h-32px items-center gap-1 px-2 bg-nc-bg-default rounded-md"
        >
          <div>{{ count }} {{ $t('objects.records') }}</div>
          <component :is="iconMap.markerAlert" aria-hidden="true" />
        </div>
      </a-tooltip>

      <PermissionsTooltip
        v-if="isUIAllowed('dataInsert') && !isSyncedTable"
        :entity="PermissionEntity.TABLE"
        :entity-id="meta?.id"
        :permission="PermissionKey.TABLE_RECORD_ADD"
        class="absolute bottom-5 left-3 z-500"
      >
        <template #default="{ isAllowed: isAllowedAddNewRecord }">
          <NcButton
            type="secondary"
            size="small"
            data-testid="nc-map-add-record-btn"
            class="!rounded-full !w-10 !h-10 !shadow-lg"
            :disabled="!isAllowedAddNewRecord"
            @click="onAddRecordClick"
          >
            <GeneralIcon icon="plus" />
          </NcButton>
        </template>
      </PermissionsTooltip>
    </div>
  </div>
  <Suspense>
    <LazySmartsheetExpandedForm
      v-if="expandedFormRow && expandedFormDlg"
      v-model="expandedFormDlg"
      :row="expandedFormRow"
      :load-row="!isPublic"
      :state="expandedFormRowState"
      :meta="meta"
      :view="view"
    />
  </Suspense>
  <Suspense>
    <LazySmartsheetExpandedForm
      v-if="expandedFormOnRowIdDlg && meta?.id"
      v-model="expandedFormOnRowIdDlg"
      :row="expandedFormRow ?? { row: {}, oldRow: {}, rowMeta: {} }"
      :meta="meta"
      :load-row="!isPublic"
      :row-id="route.query.rowId"
      :expand-form="expandForm"
      :view="view"
    />
  </Suspense>
</template>

<style scoped lang="scss">
:global(.geo-map-marker-cluster) {
  @apply bg-primary text-white font-semibold text-xs rounded-full flex items-center justify-center;
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

/* Marker hover tooltip */
.nc-map-marker-tooltip {
  padding: 0 !important;
  border-radius: 8px !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15) !important;
  border: 1px solid var(--nc-border-gray-medium, #e5e7eb) !important;
  background: var(--nc-bg-default, #fff) !important;
  max-width: 280px;
}

.nc-map-tooltip-content {
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.4;
}

.nc-map-tooltip-row {
  display: flex;
  gap: 6px;
  padding: 2px 0;
  align-items: baseline;
}

.nc-map-tooltip-row + .nc-map-tooltip-row {
  border-top: 1px solid var(--nc-bg-gray-light, #f3f4f6);
  margin-top: 2px;
  padding-top: 4px;
}

.nc-map-tooltip-label {
  color: var(--nc-content-gray-muted, #6b7280);
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
  font-size: 11px;
}

.nc-map-tooltip-label::after {
  content: ':';
}

.nc-map-tooltip-value {
  color: var(--nc-content-gray, #1f2937);
  word-break: break-word;
}

.nc-map-tooltip-coords {
  color: var(--nc-content-gray-muted, #6b7280);
  font-family: monospace;
  font-size: 11px;
}

.popup-content {
  user-select: text;
  display: flex;
  gap: 10px;
  flex-direction: column;
}
</style>
