<script lang="ts" setup>
import type { GeoLocationType } from 'nocodb-sdk'
import type { UnwrapRef, VNodeRef } from '@vue/runtime-core'
import { Modal as AModal, EditModeInj, inject, useVModel, ref } from '#imports'

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

// let error = $ref<string | undefined>()

let isExpanded = $ref(false)

// const localValue = computed<string | Record<string, any> | undefined>({
//   get: () => localValueState.value,
//   set: (val: undefined | string | Record<string, any>) => {
//     localValueState.value = typeof val === 'object' ? JSON.stringify(val, null, 2) : val
//     /** if form and not expanded then sync directly */
//     if (isForm.value && !isExpanded) {
//       vModel.value = val
//     }
//   },
// })

// const clear = () => {
//   error = undefined

//   isExpanded = false

//   editEnabled.value = false

//   localValue.value = vModel.value
// }

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

// const focus: VNodeRef = (el) => (el as HTMLInputElement)?.focus()

// function onKeyDown(evt: KeyboardEvent) {
//   return evt.key === '.' && evt.preventDefault()
// }

// const visibleMenu = ref(false)

// const toggleVisbility = () => {
//   visible.value = !visible.value
// }

// const latitude = computed(() => {

// })
// const onSave = () => {
//   isExpanded = false

//   editEnabled.value = false

//   // localValue.value = localValue ? formatJson(localValue.value as string) : localValue

//   // vModel.value = localValue.value
// }

// watch(
//   vModel,
//   (val) => {
//     localValue.value = val
//   },
//   { immediate: true },
// )

// watch(localValue, (val) => {
//   try {
//     JSON.parse(val as string)

//     error = undefined
//   } catch (e: any) {
//     error = e
//   }
// })

// watch(editEnabled, () => {
//   isExpanded = false

//   localValue.value = vModel.valuec
// })

const latLongStr = computed(() => {
  const [latitude, longitude] = vModel.value?.split(';') || [null, null]
  return latitude && longitude ? `${latitude}; ${longitude}` : 'Set location'
})

// interface LatLong {
//   latitude: number
//   longitude: number
// }

const latLong = computed(() => {
  const [latitude, longitude] = vModel.value?.split(';') || [null, null]

  return latitude == null || longitude == null
    ? null
    : {
        latitude,
        longitude,
      }
})

// const latitude = ref('INITIAL')

interface FormState {
  latitude: string
  longitude: string
}

const formState = reactive({
  latitude: latLong.value?.latitude,
  longitude: latLong.value?.longitude,
})

const handleFinish = () => {
  console.log(`handleFinish - formState: `, formState)
  vModel.value = `${formState.latitude};${formState.longitude}`
  isExpanded = false
}
</script>

<template>
  <!-- <input
    v-if="editEnabled"
    :ref="focus"
    v-model="vModel"
    class="outline-none px-2 border-none w-full h-full text-sm"
    type="string"
    @blur="editEnabled = false"
  />
  <span v-else class="text-sm">{{ vModel }}</span> -->

  <a-dropdown :is="isExpanded ? AModal : 'div'" v-model:visible="isExpanded" trigger="click">
    <a-button>{{ latLongStr }}</a-button>
    <template #overlay>
      <a-form :model="formState" @finish="handleFinish">
        <a-form-item v-model="formState.latitude" label="Latitude">
          <a-input v-model:value="formState.latitude" placeholder="input placeholder" />
          LAT:{{ formState.latitude }}
        </a-form-item>
        <a-form-item label="Longitude">
          <a-input v-model:value="formState.longitude" placeholder="input placeholder" />
          LONG:{{ formState.longitude }}
        </a-form-item>
        <a-form-item>
          <a-button type="primary" html-type="submit">Submit</a-button>
        </a-form-item>
      </a-form>
    </template>
  </a-dropdown>
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
