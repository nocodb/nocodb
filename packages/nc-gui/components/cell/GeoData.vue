<script lang="ts" setup>
import type { GeoLocationType } from 'nocodb-sdk'
import { useVModel } from '#imports'

interface Props {
  // modelValue?: GeoLocationType | null
  modelValue?: string | null
}

interface Emits {
  (event: 'update:modelValue', model: GeoLocationType): void
}

const props = defineProps<Props>()

const emits = defineEmits<Emits>()

// const editEnabled = inject(EditModeInj)

// const isForm = inject(IsFormInj, ref(false))

const vModel = useVModel(props, 'modelValue', emits)

// const localValueState = ref<string | undefined>()

let error = $ref<string | undefined>()

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
  vModel.value = `${formState.latitude};${formState.longitude}`
  isExpanded = false
}

const clear = () => {
  error = undefined

  isExpanded = false

  formState.latitude = latitude
  formState.longitude = longitude
  console.log(`clear - formState: `, formState)
}

const onGetCurrentLocation = () => {
  isLoading = true
  const onSuccess = (position) => {
    const crd = position.coords
    formState.latitude = crd.latitude
    formState.longitude = crd.longitude
    isLoading = false
  }

  const onError = (err) => {
    console.warn(`ERROR(${err.code}): ${err.message}`)
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
  <a-dropdown :is="isExpanded ? AModal : 'div'" v-model:visible="isExpanded" trigger="click" overlay-class-name="dropdown-new">
    <a-button>{{ latLongStr }}</a-button>
    <template #overlay>
      <a-form :model="formState" class="flex flex-col" @finish="handleFinish">
        <a-form-item class="inputLat" label="Lat">
          <a-input v-model:value="formState.latitude" type="number" step="0.0000001" required :max="90" :min="-90" />
        </a-form-item>
        <a-form-item class="inputLng" label="Lng">
          <a-input v-model:value="formState.longitude" type="number" step="0.0000001" required :min="-180" :max="180" />
        </a-form-item>
        <a-form-item class="flex align-center location">
          <MdiReload v-if="isLoading" :class="{ 'animate-infinite animate-spin': isLoading }" />
          <a-button @click="onGetCurrentLocation">Your Location</a-button>
        </a-form-item>
        <a-form-item class="buttons">
          <a-button type="text" @click="clear">Cancel</a-button>
          <a-button type="primary" html-type="submit">Submit</a-button>
        </a-form-item>
      </a-form>
    </template>
  </a-dropdown>
</template>

<style scoped lang="scss">
input[type='number']:focus {
  @apply ring-transparent;
}

.inputLat {
  width: 180px;
  margin-top: 1rem;
  margin-bottom: 0.5rem;
  margin-right: 0.5rem;
  margin-left: 0.5rem;
}
.inputLng {
  width: 180px;
  margin-right: 0.5rem;
}
.location {
  margin-right: 0.5rem;
  align-items: center;
}
.buttons {
  margin-left: auto;
  margin-bottom: 0;
}
.ant-dropdown-menu {
  height: fit-content;
  align-items: flex-end;
}
</style>
