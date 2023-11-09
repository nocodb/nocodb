<script lang="ts" setup>
import type { GeoLocationType } from 'nocodb-sdk'
import { Modal as AModal, iconMap, latLongToJoinedString, useVModel } from '#imports'

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
  <a-dropdown :is="isExpanded ? AModal : 'div'" v-model:visible="isExpanded" :trigger="['click']">
    <div
      v-if="!isLocationSet"
      class="group cursor-pointer flex gap-1 items-center mx-auto max-w-64 justify-center active:(ring ring-accent ring-opacity-100) rounded border-1 p-1 shadow-sm hover:(bg-primary bg-opacity-10) dark:(!bg-slate-500)"
    >
      <div class="flex items-center gap-2" data-testid="nc-geo-data-set-location-button">
        <component
          :is="iconMap.mapMarker"
          class="transform dark:(!text-white) group-hover:(!text-accent scale-120) text-gray-500 text-[0.75rem]"
        />
        <div class="group-hover:text-primary text-gray-500 dark:text-gray-200 dark:group-hover:!text-white text-xs">
          {{ latLongStr }}
        </div>
      </div>
    </div>
    <div v-else data-testid="nc-geo-data-lat-long-set">{{ latLongStr }}</div>
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
            <a-button class="ml-2" @click="onClickSetCurrentLocation"
              ><component :is="iconMap.currentLocation" class="mr-2" />{{ $t('labels.currentLocation') }}</a-button
            >
          </div>
        </a-form-item>
        <a-form-item v-if="vModel">
          <div class="mr-2 flex flex-row items-end gap-1 text-left">
            <a-button @click="openInOSM"
              ><component :is="iconMap.openInNew" class="mr-2" />{{ $t('activity.map.openInOpenStreetMap') }}</a-button
            >
            <a-button @click="openInGoogleMaps"
              ><component :is="iconMap.openInNew" class="mr-2" />{{ $t('activity.map.openInGoogleMaps') }}</a-button
            >
          </div>
        </a-form-item>
        <a-form-item>
          <div class="ml-auto mr-2 w-auto">
            <a-button type="text" @click="clear">{{ $t('general.cancel') }}</a-button>
            <a-button type="primary" html-type="submit" data-testid="nc-geo-data-save">{{ $t('general.submit') }}</a-button>
          </div>
        </a-form-item>
      </a-form>
    </template>
  </a-dropdown>
</template>

<style scoped lang="scss">
input[type='number']:focus {
  @apply ring-transparent;
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
