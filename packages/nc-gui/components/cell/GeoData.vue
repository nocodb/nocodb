<script lang="ts" setup>
import type { GeoLocationType } from 'nocodb-sdk'
import { Modal as AModal, latLongToJoinedString, useVModel } from '#imports'

interface Props {
  modelValue?: string | null
}

interface Emits {
  (event: 'update:modelValue', model: GeoLocationType): void
}

const props = defineProps<Props>()

const emits = defineEmits<Emits>()

const vModel = useVModel(props, 'modelValue', emits)

let isExpanded = $ref(false)

let isLoading = $ref(false)

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
  isExpanded = false
}

const clear = () => {
  isExpanded = false

  formState.latitude = latitude
  formState.longitude = longitude
}

const onClickSetCurrentLocation = () => {
  isLoading = true
  const onSuccess = (position) => {
    const crd = position.coords
    formState.latitude = crd.latitude
    formState.longitude = crd.longitude
    isLoading = false
  }

  const onError = (err) => {
    console.error(`ERROR(${err.code}): ${err.message}`)
    isLoading = false
  }

  const options = {
    enableHighAccuracy: true,
    timeout: 20000,
    maximumAge: 2000,
  }
  navigator.geolocation.getCurrentPosition(onSuccess, onError, options)
}
</script>

<template>
  <a-dropdown :is="isExpanded ? AModal : 'div'" v-model:visible="isExpanded" trigger="click">
    <a-button>{{ latLongStr }}</a-button>
    <template #overlay>
      <a-form :model="formState" class="flex flex-col" @finish="handleFinish">
        <a-form-item class="input-lat">
          <template #label>
            <div>{{ $t('labels.lat') }}</div>
          </template>
          <a-input
            v-model:value="formState.latitude"
            type="number"
            step="0.0000001"
            :min="-90"
            required
            :max="90"
            @keydown.stop
            @selectstart.capture.stop
            @mousedown.stop
          />
        </a-form-item>

        <a-form-item class="input-lng">
          <template #label>
            <div>{{ $t('labels.lng') }}</div>
          </template>
          <a-input
            v-model:value="formState.longitude"
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
        <a-form-item>
          <div class="flex set-location-group">
            <MdiReload v-if="isLoading" :class="{ 'animate-infinite animate-spin text-gray-500': isLoading }" />
            <a-button class="ml-2" @click="onClickSetCurrentLocation">{{ $t('labels.yourLocation') }}</a-button>
          </div>
        </a-form-item>
        <a-form-item class="btn-group-cancel-submit">
          <a-button type="text" @click="clear">{{ $t('general.cancel') }}</a-button>
          <a-button type="primary" html-type="submit">{{ $t('general.submit') }}</a-button>
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

.input-lat {
  margin-top: 1rem;
  margin-bottom: 0.5rem;
  margin-right: 0.5rem;
  margin-left: 0.5rem;
}
.input-lng {
  margin-right: 0.5rem;
  margin-left: 0.5rem;
}

.btn-group-cancel-submit {
  margin-left: auto;
  margin-bottom: 0;
}
.ant-dropdown-menu {
  align-items: flex-end;
}

.set-location-group {
  align-items: center;
  margin-right: 0.5rem;
}
</style>
