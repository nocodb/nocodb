<script lang="ts" setup>
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { type GeoLocationType, convertGeoNumberToString, latLongToJoinedString } from 'nocodb-sdk'
import { useDebounceFn } from '@vueuse/core'

interface Props {
  modelValue?: string | null
}

interface Emits {
  (event: 'update:modelValue', model: GeoLocationType): void
}

const props = defineProps<Props>()

const emits = defineEmits<Emits>()

const column = inject(ColumnInj)

const vModel = useVModel(props, 'modelValue', emits)

const activeCell = inject(ActiveCellInj, ref(false))

const isPublic = inject(IsPublicInj, ref(false))

const readonly = inject(ReadonlyInj, ref(false))

const isExpanded = ref(false)

const isLoading = ref(false)

// --- Map picker state ---
const mapContainerRef = ref<HTMLElement>()
const mapInstanceRef = ref<L.Map>()
const markerRef = ref<L.Marker>()
const isUpdatingFromMap = ref(false)

const DEFAULT_CENTER: [number, number] = [20, 0]
const DEFAULT_ZOOM = 2
const LOCATION_ZOOM = 15

function syncToFormState(lat: number, lng: number) {
  isUpdatingFromMap.value = true
  formState.latitude = convertGeoNumberToString(lat)
  formState.longitude = convertGeoNumberToString(lng)
  nextTick(() => {
    isUpdatingFromMap.value = false
  })
}

function setupMarkerDrag(marker: L.Marker) {
  marker.on('dragend', () => {
    const pos = marker.getLatLng()
    syncToFormState(pos.lat, pos.lng)
  })
}

function updateMarkerPosition(lat: number, lng: number) {
  if (!mapInstanceRef.value) return
  if (markerRef.value) {
    markerRef.value.setLatLng([lat, lng])
  } else {
    const marker = L.marker([lat, lng], { draggable: !readonly.value }).addTo(mapInstanceRef.value)
    setupMarkerDrag(marker)
    markerRef.value = marker
  }
}

function onMapClick(e: L.LeafletMouseEvent) {
  if (readonly.value) return
  const { lat, lng } = e.latlng
  updateMarkerPosition(lat, lng)
  syncToFormState(lat, lng)
}

function initMap() {
  if (!mapContainerRef.value || mapInstanceRef.value) return

  const hasCoords = formState.latitude && formState.longitude
  const lat = parseFloat(formState.latitude)
  const lng = parseFloat(formState.longitude)
  const validCoords = hasCoords && !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
  const center: [number, number] = validCoords ? [lat, lng] : DEFAULT_CENTER
  const zoom = validCoords ? LOCATION_ZOOM : DEFAULT_ZOOM

  const map = L.map(mapContainerRef.value, {
    center,
    zoom,
    zoomControl: true,
    attributionControl: true,
  })

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map)

  if (validCoords) {
    const marker = L.marker(center, { draggable: !readonly.value }).addTo(map)
    setupMarkerDrag(marker)
    markerRef.value = marker
  }

  map.on('click', onMapClick)
  mapInstanceRef.value = map
}

function destroyMap() {
  if (mapInstanceRef.value) {
    mapInstanceRef.value.remove()
    mapInstanceRef.value = undefined
    markerRef.value = undefined
  }
}

// --- Geocoding search (Nominatim / OpenStreetMap) ---
interface NominatimResult {
  place_id: number
  lat: string
  lon: string
  display_name: string
  type: string
}

const searchQuery = ref('')
const searchResults = ref<NominatimResult[]>([])
const isSearching = ref(false)
const showSearchResults = ref(false)
const searchInputRef = ref<HTMLInputElement>()

const NOMINATIM_API = 'https://nominatim.openstreetmap.org/search'

let searchAbortController: AbortController | null = null
let searchBlurTimer: ReturnType<typeof setTimeout> | null = null
let copyTooltipTimer: ReturnType<typeof setTimeout> | null = null

const performSearch = useDebounceFn(async () => {
  const query = searchQuery.value.trim()
  if (query.length < 3) {
    searchResults.value = []
    showSearchResults.value = false
    return
  }

  // Abort any in-flight request
  searchAbortController?.abort()
  searchAbortController = new AbortController()

  isSearching.value = true
  try {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: '5',
      addressdetails: '0',
    })

    const response = await fetch(`${NOMINATIM_API}?${params.toString()}`, {
      headers: {
        'Accept-Language': navigator.language || 'en',
      },
      signal: searchAbortController.signal,
    })

    if (!response.ok) throw new Error('Geocoding request failed')

    const data: NominatimResult[] = await response.json()
    searchResults.value = data
    showSearchResults.value = data.length > 0
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') return
    console.error('Geocoding error:', err)
    searchResults.value = []
    showSearchResults.value = false
  } finally {
    isSearching.value = false
  }
}, 400)

function selectSearchResult(result: NominatimResult) {
  const lat = parseFloat(result.lat)
  const lng = parseFloat(result.lon)

  // Update form state
  syncToFormState(lat, lng)

  // Update map
  updateMarkerPosition(lat, lng)
  mapInstanceRef.value?.setView([lat, lng], LOCATION_ZOOM)

  // Clear search
  searchQuery.value = result.display_name
  showSearchResults.value = false
}

function onSearchKeydown(e: KeyboardEvent) {
  // Prevent overlay from closing on Escape when search has results
  if (e.key === 'Escape' && showSearchResults.value) {
    e.stopPropagation()
    showSearchResults.value = false
    return
  }
  // Prevent form submission on Enter in search
  if (e.key === 'Enter') {
    e.preventDefault()
    e.stopPropagation()
  }
}

function onSearchBlur() {
  // Delay hiding to allow click on result
  if (searchBlurTimer) clearTimeout(searchBlurTimer)
  searchBlurTimer = setTimeout(() => {
    showSearchResults.value = false
  }, 200)
}

watch(searchQuery, () => {
  if (searchQuery.value.trim().length >= 3) {
    performSearch()
  } else {
    searchResults.value = []
    showSearchResults.value = false
  }
})

// Debounced sync: input fields -> map
const syncMapFromInputs = useDebounceFn(() => {
  if (isUpdatingFromMap.value || !mapInstanceRef.value) return

  const lat = parseFloat(formState.latitude)
  const lng = parseFloat(formState.longitude)
  if (isNaN(lat) || isNaN(lng)) return
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return

  updateMarkerPosition(lat, lng)
  mapInstanceRef.value.setView([lat, lng], Math.max(mapInstanceRef.value.getZoom(), LOCATION_ZOOM))
}, 500)

const identifier = {
  latitude: `nc-geo-lat-${Math.random().toString(36).substring(2, 10)}`,
  longitude: `nc-geo-lng-${Math.random().toString(36).substring(2, 10)}`,
}

const isLocationSet = computed(() => {
  return !!vModel.value
})

const [latitude, longitude] = (vModel.value || '').split(';')

const { t } = useI18n()

const latLongStr = computed(() => {
  const [latitude, longitude] = (vModel.value || '').split(';')
  return latitude && longitude ? `${latitude}; ${longitude}` : t('labels.setLocation')
})

const formState = reactive({
  latitude,
  longitude,
})

const isLatitudeInvalid = computed(() => {
  if (!formState.latitude) return false
  const lat = parseFloat(formState.latitude)
  return isNaN(lat) || lat < -90 || lat > 90
})

const isLongitudeInvalid = computed(() => {
  if (!formState.longitude) return false
  const lng = parseFloat(formState.longitude)
  return isNaN(lng) || lng < -180 || lng > 180
})

const handleFinish = () => {
  if (isLatitudeInvalid.value || isLongitudeInvalid.value) return
  vModel.value = latLongToJoinedString(parseFloat(formState.latitude), parseFloat(formState.longitude))
  isExpanded.value = false
}

const clear = () => {
  isExpanded.value = false

  formState.latitude = latitude
  formState.longitude = longitude
}

const onClickSetCurrentLocation = () => {
  isLoading.value = true
  const onSuccess: PositionCallback = (position: GeolocationPosition) => {
    const crd = position.coords
    formState.latitude = `${convertGeoNumberToString(crd.latitude)}`
    formState.longitude = `${convertGeoNumberToString(crd.longitude)}`
    isLoading.value = false
  }

  const onError: PositionErrorCallback = (err: GeolocationPositionError) => {
    console.error(`ERROR(${err.code}): ${err.message}`)
    isLoading.value = false
  }

  const options = {
    enableHighAccuracy: true,
    timeout: 20000,
    maximumAge: 2000,
  }
  navigator.geolocation.getCurrentPosition(onSuccess, onError, options)
}

const openInGoogleMaps = () => {
  const [latitude, longitude] = (vModel.value || '').split(';')
  if (!latitude || !longitude) return
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(latitude)},${encodeURIComponent(longitude)}`
  window.open(url, '_blank', 'noopener,noreferrer')
}

const openInOSM = () => {
  const [latitude, longitude] = (vModel.value || '').split(';')
  if (!latitude || !longitude) return
  const url = `https://www.openstreetmap.org/?mlat=${encodeURIComponent(latitude)}&mlon=${encodeURIComponent(longitude)}#map=15/${latitude}/${longitude}`
  window.open(url, '_blank', 'noopener,noreferrer')
}

const handleClose = (e: MouseEvent) => {
  if (e.target instanceof HTMLElement && !e.target.closest('.nc-geodata-picker-overlay')) {
    isExpanded.value = false
  }
}

useEventListener(document, 'click', handleClose, true)

/**
 * Parse a pasted string into "lat;lng" format.
 * Accepts: "lat;lng", "lat,lng", "lat, lng", or "lat lng"
 * Returns the normalised "lat;lng" string, or null if unparseable.
 */
function parseGeoString(raw: string): string | null {
  const trimmed = raw.trim()

  // Try convertCellData first (handles NocoDB internal formats) — but only when column metadata is available
  if (column?.value?.uidt) {
    try {
      const converted = convertCellData(
        { value: trimmed, to: column.value.uidt, column: column.value },
        false,
      )
      if (converted) return converted
    } catch {
      // fall through to manual parsing
    }
  }

  // Manual parsing: split on ; or , or whitespace
  const parts = trimmed.split(/[;,\s]+/).filter(Boolean)
  if (parts.length === 2) {
    const lat = parseFloat(parts[0])
    const lng = parseFloat(parts[1])
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return `${convertGeoNumberToString(lat)};${convertGeoNumberToString(lng)}`
    }
  }
  return null
}

const handlePaste = (e: ClipboardEvent) => {
  if ([identifier.latitude, identifier.longitude].includes(e.target?.id)) {
    return
  }
  const clipboardData = e.clipboardData?.getData('text/plain') || ''
  if (!clipboardData) return

  // Allow paste both when overlay is open AND when in expanded form (overlay may be closed)
  if (isExpanded.value || isExpandedForm.value) {
    const value = parseGeoString(clipboardData)
    if (value) {
      const pastedLat = value.split(';')[0]
      const pastedLng = value.split(';')[1]
      formState.latitude = pastedLat
      formState.longitude = pastedLng

      // In expanded form with overlay closed, commit directly
      if (isExpandedForm.value && !isExpanded.value) {
        e.preventDefault()
        vModel.value = latLongToJoinedString(parseFloat(pastedLat), parseFloat(pastedLng))
      }
    }
  }
}

const isUnderLookup = inject(IsUnderLookupInj, ref(false))
const isCanvasInjected = inject(IsCanvasInjectionInj, false)
const isExpandedForm = inject(IsExpandedFormOpenInj, ref(false))
const isGrid = inject(IsGridInj, ref(false))
const isEditColumn = inject(EditColumnInj, ref(false))
const isForm = inject(IsFormInj, ref(false))

const handleBlur = (e: Event) => {
  const target = e.target as HTMLInputElement
  const originalValue = target.value
  const value = convertGeoNumberToString(Number(originalValue))
  if (value !== originalValue) {
    if (target.id === identifier.latitude) {
      formState.latitude = value
    } else if (target.id === identifier.longitude) {
      formState.longitude = value
    }
  }
}

onMounted(() => {
  if (!isUnderLookup.value && isCanvasInjected && !isExpandedForm.value && isGrid.value && !isEditColumn.value) {
    forcedNextTick(() => {
      isExpanded.value = true
    })
  }
})

watch(
  () => vModel,
  (newValue) => {
    if (newValue.value) {
      formState.latitude = newValue.value?.split(';')[0]
      formState.longitude = newValue.value?.split(';')[1]
    } else {
      formState.latitude = ''
      formState.longitude = ''
    }
  },
)

const isCopied = ref(false)

const copyCoordinates = (e: Event) => {
  e.stopPropagation()
  const text = latLongStr.value
  if (text && text !== t('labels.setLocation')) {
    navigator.clipboard.writeText(text).then(() => {
      isCopied.value = true
      if (copyTooltipTimer) clearTimeout(copyTooltipTimer)
      copyTooltipTimer = setTimeout(() => {
        isCopied.value = false
      }, 2000)
    })
  }
}

const openEditor = (e: Event) => {
  e.stopPropagation()
  if (!readonly.value) {
    isExpanded.value = true
  }
}

const handleKeyDown = (e: KeyboardEvent) => {
  // Allow copy shortcuts to pass through
  if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
    return
  }

  if (e.key === 'Escape' && isExpanded.value) {
    e.preventDefault()
    e.stopImmediatePropagation()
    isExpanded.value = false
  }

  if (e.key === 'Enter') {
    e.preventDefault()
    if (readonly.value) {
      return
    }
    isExpanded.value = !isExpanded.value
  }
}

// --- Map lifecycle: init when overlay opens, destroy when it closes ---
watch(isExpanded, async (expanded) => {
  if (expanded) {
    await nextTick()
    // Leaflet needs the container to be fully rendered and sized
    setTimeout(() => {
      initMap()
      mapInstanceRef.value?.invalidateSize()
    }, 150)
  } else {
    destroyMap()
  }
})

// --- Bidirectional sync: input fields -> map (debounced) ---
watch(
  () => [formState.latitude, formState.longitude],
  () => {
    syncMapFromInputs()
  },
)

// --- Cleanup on unmount ---
onBeforeUnmount(() => {
  destroyMap()
  searchAbortController?.abort()
  if (searchBlurTimer) clearTimeout(searchBlurTimer)
  if (copyTooltipTimer) clearTimeout(copyTooltipTimer)
})
</script>

<template>
  <div tabindex="0" class="focus-visible:outline-none" @paste="handlePaste" @keydown="handleKeyDown">
    <NcDropdown v-model:visible="isExpanded" :disabled="readonly" overlay-class-name="!min-w-[28rem]">
      <div
        v-if="!isLocationSet"
        :class="{
          '!justify-start !ml-0 ': isExpandedForm || isForm,
          'mt-0.5': isForm && !isPublic,
          '!-mt-0.25': isForm && isPublic,
        }"
        class="w-full flex justify-center max-w-64 mx-auto"
      >
        <NcButton
          v-if="(activeCell && !readonly) || isForm"
          size="xsmall"
          type="secondary"
          data-testid="nc-geo-data-set-location-button"
        >
          <div class="flex items-center px-2 gap-2">
            <GeneralIcon class="text-nc-content-gray-muted h-3.5 w-3.5" icon="ncMapPin" />
            <span class="text-tiny">
              {{ latLongStr }}
            </span>
          </div>
        </NcButton>
      </div>

      <div
        v-else
        data-testid="nc-geo-data-lat-long-set"
        tabindex="1"
        :class="{
          '!py-1': !isForm,
          'pt-1': isForm && !isPublic,
        }"
        class="nc-cell-field h-full w-full flex items-center focus-visible:!outline-none focus:!outline-none"
      >
        <!-- Expanded form: selectable text with copy + edit buttons -->
        <template v-if="isExpandedForm">
          <span class="nc-geodata-selectable-text" @click.stop>{{ latLongStr }}</span>
          <div class="nc-geodata-action-icons" @click.stop>
            <NcTooltip>
              <template #title>{{ isCopied ? $t('general.copied') : $t('general.copy') }}</template>
              <GeneralIcon
                :icon="isCopied ? 'check' : 'copy'"
                class="nc-geodata-action-icon"
                :class="{ '!text-green-600': isCopied }"
                :aria-label="isCopied ? $t('general.copied') : $t('general.copy')"
                role="button"
                tabindex="0"
                @click="copyCoordinates"
                @keydown.enter="copyCoordinates"
              />
            </NcTooltip>
            <NcTooltip v-if="!readonly">
              <template #title>{{ $t('general.edit') }}</template>
              <GeneralIcon
                icon="ncEdit"
                class="nc-geodata-action-icon"
                :aria-label="$t('general.edit')"
                role="button"
                tabindex="0"
                @click="openEditor"
                @keydown.enter="openEditor"
              />
            </NcTooltip>
          </div>
        </template>
        <!-- Grid view: click anywhere to open editor (existing behavior) -->
        <template v-else>
          {{ latLongStr }}
        </template>
      </div>
      <template #overlay>
        <div class="flex rounded-md nc-geodata-picker-overlay py-3" @click.stop @paste="handlePaste">
          <a-form layout="vertical" :model="formState" class="flex flex-col" @finish="handleFinish">
            <a-row class="flex gap-3 px-3">
              <a-form-item
                :label="$t('labels.latitude')"
                :validate-status="isLatitudeInvalid ? 'error' : ''"
                :help="isLatitudeInvalid ? t('msg.error.latitudeRange') : ''"
              >
                <a-input
                  :id="identifier.latitude"
                  v-model:value="formState.latitude"
                  data-testid="nc-geo-data-latitude"
                  type="number"
                  step="0.0000000001"
                  class="nc-input-shadow !w-50"
                  :min="-90"
                  :disabled="readonly"
                  required
                  :max="90"
                  @blur="handleBlur"
                  @keydown.stop
                  @selectstart.capture.stop
                  @mousedown.stop
                />
              </a-form-item>

              <a-form-item
                :label="$t('labels.longitude')"
                :validate-status="isLongitudeInvalid ? 'error' : ''"
                :help="isLongitudeInvalid ? t('msg.error.longitudeRange') : ''"
              >
                <a-input
                  :id="identifier.longitude"
                  v-model:value="formState.longitude"
                  class="nc-input-shadow !w-50"
                  data-testid="nc-geo-data-longitude"
                  type="number"
                  step="0.0000000001"
                  required
                  :min="-180"
                  :disabled="readonly"
                  :max="180"
                  @blur="handleBlur"
                  @keydown.stop
                  @selectstart.capture.stop
                  @mousedown.stop
                />
              </a-form-item>
            </a-row>

            <!-- Location search bar -->
            <div v-if="!readonly" class="nc-geodata-search-wrapper px-3 mb-2">
              <div class="nc-geodata-search-container">
                <div class="nc-geodata-search-input-row">
                  <GeneralIcon icon="search" class="nc-geodata-search-icon" />
                  <input
                    ref="searchInputRef"
                    v-model="searchQuery"
                    data-testid="nc-geo-data-search"
                    type="text"
                    class="nc-geodata-search-input"
                    :placeholder="$t('labels.searchForPlace')"
                    role="combobox"
                    :aria-expanded="showSearchResults"
                    aria-autocomplete="list"
                    aria-controls="nc-geo-search-results"
                    @keydown="onSearchKeydown"
                    @blur="onSearchBlur"
                    @keydown.stop
                    @mousedown.stop
                  />
                  <GeneralIcon
                    v-if="isSearching"
                    icon="loading"
                    class="nc-geodata-search-spinner animate-spin"
                  />
                </div>
                <div v-if="showSearchResults" id="nc-geo-search-results" role="listbox" class="nc-geodata-search-results">
                  <div
                    v-for="result in searchResults"
                    :key="result.place_id"
                    role="option"
                    class="nc-geodata-search-result-item"
                    @mousedown.prevent="selectSearchResult(result)"
                  >
                    <GeneralIcon icon="ncMapPin" class="nc-geodata-result-icon" />
                    <span class="nc-geodata-result-text">{{ result.display_name }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Interactive map picker -->
            <div
              ref="mapContainerRef"
              data-testid="nc-geo-data-map-picker"
              class="nc-geodata-map-picker"
              role="application"
              :aria-label="$t('labels.mapPicker')"
            />

            <NcDivider />

            <div class="flex px-3 mt-2 flex-col gap-2">
              <div class="flex">
                <div class="flex gap-2">
                  <NcButton size="small" type="secondary" :loading="isLoading" :disabled="isLoading" @click="onClickSetCurrentLocation">
                    <div class="flex items-center gap-2">
                      <GeneralIcon v-if="!isLoading" icon="currentLocation" class="h-4 w-4" />
                      {{ $t('labels.currentLocation') }}
                    </div>
                  </NcButton>
                </div>
                <div class="flex-1" />
                <div v-if="vModel" class="flex gap-2">
                  <NcButton type="secondary" size="small" @click="openInGoogleMaps">
                    <div class="flex items-center gap-2">
                      <GeneralIcon icon="ncLogoGoogleMapColored" />
                      {{ $t('activity.map.googleMaps') }}
                    </div>
                  </NcButton>

                  <NcButton type="secondary" size="small" @click="openInOSM">
                    <div class="flex items-center gap-2">
                      <GeneralIcon class="w-4 h-4" icon="ncLogoOpenStreetMapColored" />
                      {{ $t('activity.map.osm') }}
                    </div>
                  </NcButton>
                </div>
              </div>

              <div class="flex gap-3 justify-end">
                <NcButton type="secondary" size="small" @click="clear">
                  {{ $t('general.cancel') }}
                </NcButton>

                <NcButton html-type="submit" size="small" data-testid="nc-geo-data-save">
                  {{ $t('general.submit') }}
                </NcButton>
              </div>
            </div>
          </a-form>
        </div>
      </template>
    </NcDropdown>
  </div>
</template>

<style scoped lang="scss">
input[type='number']:focus {
  @apply ring-transparent shadow-selected;
}
input[type='number'] {
  @apply !border-1 !pr-1 rounded-lg;
}

.ant-form-item {
  margin-bottom: 1rem;
}

:deep(.ant-form-item-label > label) {
  @apply !text-small !leading-[18px] mb-2 text-nc-content-gray flex;
}

/* Selectable coordinate text in expanded form */
.nc-geodata-selectable-text {
  user-select: text;
  cursor: text;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nc-geodata-action-icons {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 8px;
  flex-shrink: 0;
}

.nc-geodata-action-icon {
  @apply w-4 h-4 text-nc-content-gray-muted cursor-pointer;
  transition: color 0.15s;

  &:hover {
    @apply text-nc-content-gray;
  }
}

/* Location search bar */
.nc-geodata-search-wrapper {
  position: relative;
}

.nc-geodata-search-container {
  position: relative;
}

.nc-geodata-search-input-row {
  @apply flex items-center border-1 border-nc-border-gray-medium rounded-lg bg-nc-bg-default;
  padding: 0 10px;
  height: 36px;
  transition: border-color 0.2s;

  &:focus-within {
    @apply border-nc-border-brand shadow-selected;
  }
}

.nc-geodata-search-icon {
  @apply text-nc-content-gray-muted w-4 h-4 flex-shrink-0;
}

.nc-geodata-search-spinner {
  @apply text-nc-content-gray-muted w-3.5 h-3.5 flex-shrink-0;
}

.nc-geodata-search-input {
  @apply flex-1 border-none outline-none text-nc-content-gray bg-transparent min-w-0;
  font-size: 13px;
  padding: 0 8px;

  &::placeholder {
    @apply text-nc-content-gray-muted;
  }
}

.nc-geodata-search-results {
  @apply absolute top-full left-0 right-0 bg-nc-bg-default border-1 border-nc-border-gray-medium rounded-lg shadow-lg z-10;
  margin-top: 4px;
  max-height: 200px;
  overflow-y: auto;
}

.nc-geodata-search-result-item {
  @apply flex items-start gap-2 px-3 py-2 cursor-pointer;
  transition: background 0.15s;

  &:hover {
    @apply bg-nc-bg-gray-light;
  }

  &:first-child {
    border-radius: 8px 8px 0 0;
  }

  &:last-child {
    border-radius: 0 0 8px 8px;
  }

  &:only-child {
    border-radius: 8px;
  }
}

.nc-geodata-result-icon {
  @apply text-nc-content-gray-muted w-3.5 h-3.5 flex-shrink-0 mt-0.5;
}

.nc-geodata-result-text {
  @apply text-nc-content-gray text-xs leading-[1.4];
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

/* Interactive map picker */
.nc-geodata-map-picker {
  @apply border-1 border-nc-border-gray-medium rounded-lg overflow-hidden;
  height: 250px;
  width: calc(100% - 24px);
  margin: 0 12px 8px 12px;
  z-index: 0;
}

:deep(.nc-geodata-map-picker .leaflet-control-zoom) {
  border: none;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);

  a {
    text-decoration: none !important;
  }
}

:deep(.nc-geodata-map-picker .leaflet-control-attribution) {
  @apply text-[10px] bg-nc-bg-default/80;
}
</style>
