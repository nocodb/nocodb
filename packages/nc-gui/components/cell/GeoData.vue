<script lang="ts" setup>
import type { GeoLocationType } from 'nocodb-sdk'
import { EditModeInj, inject, useVModel } from '#imports'

interface Props {
  modelValue?: GeoLocationType | null
}

interface Emits {
  (event: 'update:modelValue', model: GeoLocationType): void
}

const props = defineProps<Props>()

const emits = defineEmits<Emits>()

const vModel = useVModel(props, 'modelValue', emits)

const editEnabled = inject(EditModeInj)

const latitudeInput = ref(String(vModel?.value?.latitude) || '')
const longitudeInput = ref(String(vModel?.value?.latitude) || '')

const onSubmit = () => {
  if (latitudeInput == null || longitudeInput == null) {
    console.error("Tried to submit a GeoLocation where latitude or longitude value wasn't provicde")
    return
  }
  emits('update:modelValue', {
    latitude: Number.parseFloat(latitudeInput.value),
    longitude: Number.parseFloat(longitudeInput.value),
  })
}

// const isOpen = ref(false)

// const visible = ref<boolean>(false)

// const readOnly = inject(ReadonlyInj)!

// const focus: VNodeRef = (el) => (el as HTMLInputElement)?.focus()

// const toggleVisbility = () => {
//   visible.value = !visible.value
// }

// const latitude = computed(() => {

// })
</script>

<template>
  <a-popover v-model:visible="editEnabled" placement="bottomLeft" :style="{ maxWidth: '100px' }">
    <template #content>
      <div>
        Test222
        {{ JSON.stringify(vModel) }}
        <div :style="{ display: 'flex', flexDirection: 'column' }">
          <label for="latitude">latitude</label>
          <a-input id="latitude" v-model="latitudeInput" />
          <!-- <span v-else class="text-sm">{{ latitudeInput }}</span> -->
          <label for="longitude">longitude</label>
          <a-input id="longitude" v-model="longitudeInput" />
          <!-- <span v-else class="text-sm">{{ longitudeInput }}</span> -->
          <a-button type="primary" @click="onSubmit">Ok</a-button>
        </div>
      </div>
    </template>
    <a-button type="primary" :style="{ width: '100%' }">hej</a-button>
  </a-popover>
</template>

<style scoped lang="scss">
input[type='number']:focus {
  @apply ring-transparent;
}
input {
  margin-bottom: 8px;
  max-width: 200px;
}
</style>
