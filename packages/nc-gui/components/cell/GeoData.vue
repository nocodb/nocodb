<script lang="ts" setup>
import type { GeoLocationType } from 'nocodb-sdk'
import type { VNodeRef } from '@vue/runtime-core'
import { EditModeInj, inject, useVModel, ref } from '#imports'

interface Props {
  modelValue?: string | null
}

interface Emits {
  (event: 'update:modelValue', model: GeoLocationType): void
}

const props = defineProps<Props>()

const emits = defineEmits<Emits>()

const vModel = useVModel(props, 'modelValue', emits)

const editEnabled = inject(EditModeInj)

// const isPopupOpen = ref(false)
// const showPopup = () => (isPopupOpen.value = true)

// const latitudeInput = ref(String(vModel?.value?.latitude) || '')
// const longitudeInput = ref(String(vModel?.value?.latitude) || '')

// const onSubmit = () => {
//   if (latitudeInput == null || longitudeInput == null) {
//     console.error("Tried to submit a GeoLocation where latitude or longitude value wasn't provicde")
//     return
//   }
//   emits('update:modelValue', {
//     latitude: Number.parseFloat(latitudeInput.value),
//     longitude: Number.parseFloat(longitudeInput.value),
//   })
// }

// const onAbort = () => alert('ABORT!')

// const isOpen = ref(false)

// const visible = ref<boolean>(false)

// const readOnly = inject(ReadonlyInj)!

const focus: VNodeRef = (el) => (el as HTMLInputElement)?.focus()

function onKeyDown(evt: KeyboardEvent) {
  return evt.key === '.' && evt.preventDefault()
}

// const toggleVisbility = () => {
//   visible.value = !visible.value
// }

// const latitude = computed(() => {

// })
</script>

<template>
  <input
    v-if="editEnabled"
    :ref="focus"
    v-model="vModel"
    class="outline-none px-2 border-none w-full h-full text-sm"
    type="string"
    @blur="editEnabled = false"
  />
  <span v-else class="text-sm">{{ vModel }}</span>
</template>

<!-- <template>
 editEnabled: {{ JSON.stringify(editEnabled) }}
 <div @click="showPopup">
    TEST 
  <a-popover
    v-model:visible="isPopupOpen"
    placement="bottomLeft"
    :style="{ maxWidth: '100px' }"
    trigger="click"
    :destroy-on-close="true"
    :onabort="{ onAbort }"
    
    onloadstart="onAbort"
    destroy-tooltip-on-hide="true"
  >
    <template #content>
      <div>
        <div :style="{ display: 'flex', flexDirection: 'column' }">
          <label for="latitude">latitude</label>
          <a-input id="latitude" v-model="latitudeInput" />
          <span v-else class="text-sm">{{ latitudeInput }}</span> 
          <label for="longitude">longitude</label>
          <a-input id="longitude" v-model="longitudeInput" />
           <span v-else class="text-sm">{{ longitudeInput }}</span> 
          <a-button type="primary" @click="onSubmit">Ok</a-button>
        </div>
      </div>
    </template>
    <div :style="{ width: '100%' }">No data yet</div>
  </a-popover>
  </div> 
</template> -->

<!-- <template>
  <a-dropdown :trigger="['click']">
    <a class="ant-dropdown-link" @click.prevent>
      Click me
      <DownOutlined />
    </a>
    <template #overlay>
      <div :style="{ display: 'flex', flexDirection: 'column' }">
        <label for="latitude">latitude</label>
        <a-input id="latitude" v-model="latitudeInput" />
        <span class="text-sm">{{ latitudeInput }}</span>
        <label for="longitude">longitude</label>
        <a-input id="longitude" v-model="longitudeInput" />
        <span class="text-sm">{{ longitudeInput }}</span>
        <a-button type="primary" @click="onSubmit">Ok</a-button>
      </div>
    </template>
  </a-dropdown>
</template> -->
<!-- <template>
  <a-dropdown >
    <a-button>click</a-button>
    <template #overlay>
      <a-form v-model="vModel">
        <a-form-item label="Field A">
          <a-input v-model="latitudeInput" placeholder="input placeholder" />
        </a-form-item>
        <a-form-item label="Field B">
          <a-input v-model="longitudeInput" placeholder="input placeholder" />
        </a-form-item>
        <a-form-item>
          <a-button type="primary">Submit</a-button>
        </a-form-item>
      </a-form>
    </template>
  </a-dropdown>
</template> -->

<style scoped lang="scss">
input[type='number']:focus {
  @apply ring-transparent;
}
input {
  margin-bottom: 8px;
  max-width: 200px;
}
</style>
