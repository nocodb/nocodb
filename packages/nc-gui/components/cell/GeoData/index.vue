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

const isExpanded = ref(false)

const isLoading = ref(false)

const isLocationSet = ref(false)

const [latitude, longitude] = (vModel.value || '').split(';')

const latLongStr = computed(() => {
  const [latitude, longitude] = (vModel.value || '').split(';')
  if (latitude) isLocationSet.value = true
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
</script>

<template>
  <NcDropdown v-model:visible="isExpanded" overlay-class-name="overflow-hidden !min-w-64 !max-w-64" destroy-popup-on-hide>
    <div v-if="!isLocationSet" class="w-full flex justify-center max-w-64 mx-auto">
      <NcButton
        size="xsmall"
        type="secondary"
        data-testid="nc-geo-data-set-location-button"
        class="w-full max-w-64 !px-2 group !text-gray-500 !hover:text-primary !text-xs"
        @click="localEditEnabled = true"
      >
        <div class="flex items-center gap-1.5">
          <component :is="iconMap.mapMarker" class="transform group-hover:(!text-accent scale-110) text-[0.75rem]" />

          {{ latLongStr }}
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
      <a-form :model="formState" class="flex flex-col w-max-64" @finish="handleFinish">
        <a-form-item>
          <div class="flex mt-4 items-center mx-2">
            <div class="mr-2">{{ $t('labels.lat') }}:</div>
            <a-input
              v-model:value="formState.latitude"
              data-testid="nc-geo-data-latitude"
              type="number"
              step="0.0000001"
              :min="-90"
              required
              :max="90"
              @keydown.stop
              @selectstart.capture.stop
              @mousedown.stop
            />
          </div>
        </a-form-item>

        <a-form-item>
          <div class="flex items-center mx-2">
            <div class="mr-2">{{ $t('labels.lng') }}:</div>
            <a-input
              v-model:value="formState.longitude"
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
          </div>
        </a-form-item>
        <a-form-item>
          <div class="mr-2 flex flex-col items-end gap-1 text-left">
            <component
              :is="iconMap.reload"
              v-if="isLoading"
              :class="{ 'animate-infinite animate-spin text-gray-500': isLoading }"
            />
            <a-button class="ml-2 !rounded-lg" @click="onClickSetCurrentLocation">
              <div class="flex items-center gap-1">
                <component :is="iconMap.currentLocation" />{{ $t('labels.currentLocation') }}
              </div>
            </a-button>
          </div>
        </a-form-item>
        <a-form-item v-if="vModel">
          <div class="mr-2 flex flex-row items-end gap-1 text-left">
            <a-button class="!rounded-lg" @click="openInOSM">
              <div class="flex items-center gap-1">
                <component :is="iconMap.openInNew" />{{ $t('activity.map.openInOpenStreetMap') }}
              </div>
            </a-button>
            <a-button class="!rounded-lg" @click="openInGoogleMaps">
              <div class="flex items-center gap-1">
                <component :is="iconMap.openInNew" />{{ $t('activity.map.openInGoogleMaps') }}
              </div>
            </a-button>
          </div>
        </a-form-item>
        <a-form-item>
          <div class="ml-auto mr-2 w-auto">
            <a-button type="text" class="!rounded-lg" @click="clear">{{ $t('general.cancel') }}</a-button>
            <a-button type="primary" html-type="submit" data-testid="nc-geo-data-save" class="!rounded-lg">{{
              $t('general.submit')
            }}</a-button>
          </div>
        </a-form-item>
      </a-form>
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

input[type='number'] {
  width: 180px;
}
.ant-form-item {
  margin-bottom: 1rem;
}
.ant-dropdown-menu {
  align-items: flex-end;
}
</style>
