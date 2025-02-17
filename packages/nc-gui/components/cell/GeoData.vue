<script lang="ts" setup>
import type { GeoLocationType } from 'nocodb-sdk'

interface Props {
  modelValue?: string | null
}

interface Emits {
  (event: 'update:modelValue', model: GeoLocationType): void
}

const props = defineProps<Props>()

const emits = defineEmits<Emits>()

const vModel = useVModel(props, 'modelValue', emits)

const activeCell = inject(ActiveCellInj, ref(false))

const isExpanded = ref(false)

const isLoading = ref(false)

const isLocationSet = computed(() => {
  return !!vModel.value
})

const [latitude, longitude] = (vModel.value || '').split(';')

const latLongStr = computed(() => {
  const [latitude, longitude] = (vModel.value || '').split(';')
  return latitude && longitude ? `${latitude}; ${longitude}` : 'Set location'
})

const formState = reactive({
  latitude,
  longitude,
})

const handleFinish = () => {
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
    formState.latitude = `${crd.latitude}`
    formState.longitude = `${crd.longitude}`
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
  const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
  window.open(url, '_blank', 'noopener,noreferrer')
}

const openInOSM = () => {
  const [latitude, longitude] = (vModel.value || '').split(';')
  const url = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=15/${latitude}/${longitude}`
  window.open(url, '_blank', "'noopener,noreferrer'")
}

const handleClose = (e: MouseEvent) => {
  if (e.target instanceof HTMLElement && !e.target.closest('.nc-geodata-picker-overlay')) {
    isExpanded.value = false
  }
}

useEventListener(document, 'click', handleClose, true)

const isUnderLookup = inject(IsUnderLookupInj, ref(false))
const isCanvasInjected = inject(IsCanvasInjectionInj, false)
const isExpandedForm = inject(IsExpandedFormOpenInj, ref(false))
const isGrid = inject(IsGridInj, ref(false))
onMounted(() => {
  if (!isUnderLookup.value && isCanvasInjected && !isExpandedForm.value && isGrid.value) {
    forcedNextTick(() => {
      isExpanded.value = true
    })
  }
})
</script>

<template>
  <NcDropdown v-model:visible="isExpanded" :trigger="['click']">
    <div v-if="!isLocationSet" class="w-full flex justify-center max-w-64 mx-auto">
      <NcButton v-if="activeCell" size="xsmall" type="secondary" data-testid="nc-geo-data-set-location-button">
        <div class="flex items-center px-2 gap-2">
          <GeneralIcon class="text-gray-500 h-3.5 w-3.5" icon="ncMapPin" />
          <span class="text-tiny">
            {{ latLongStr }}
          </span>
        </div>
      </NcButton>
    </div>

    <div
      v-else
      data-testid="nc-geo-data-lat-long-set"
      tabindex="0"
      class="nc-cell-field h-full w-full flex items-center py-1 focus-visible:!outline-none focus:!outline-none"
    >
      {{ latLongStr }}
    </div>
    <template #overlay>
      <div class="flex rounded-md nc-geodata-picker-overlay py-3" @click.stop>
        <a-form layout="vertical" :model="formState" class="flex flex-col" @finish="handleFinish">
          <a-row class="flex gap-3 px-3">
            <a-form-item :label="$t('labels.latitude')">
              <a-input
                v-model:value="formState.latitude"
                data-testid="nc-geo-data-latitude"
                type="number"
                step="0.0000001"
                class="nc-input-shadow !w-50"
                :min="-90"
                required
                :max="90"
                @keydown.stop
                @selectstart.capture.stop
                @mousedown.stop
              />
            </a-form-item>

            <a-form-item :label="$t('labels.longitude')">
              <a-input
                v-model:value="formState.longitude"
                class="nc-input-shadow !w-50"
                data-testid="nc-geo-data-longitude"
                type="number"
                step="0.0000001"
                required
                :min="-180"
                :max="180"
                @keydown.stop
                @selectstart.capture.stop
                @mousedown.stop
              />
            </a-form-item>
          </a-row>
          <NcDivider />

          <div class="flex px-3 mt-2">
            <NcButton size="small" type="secondary" @click="onClickSetCurrentLocation">
              <div class="flex items-center gap-2">
                <GeneralIcon icon="currentLocation" />
                {{ $t('labels.currentLocation') }}
              </div>
            </NcButton>
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

            <div v-else class="flex gap-3 justify-end">
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
</style>
