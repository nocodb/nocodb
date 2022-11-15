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

const [latitude, longitude] = (vModel.value || '').split(';')

const latLongStr = computed(() => {
  const [latitude, longitude] = (vModel.value || '').split(';')
  return latitude && longitude ? `${latitude}; ${longitude}` : 'Set location'
})

// interface LatLong {
//   latitude: number
//   longitude: number
// }



// const latitude = ref('INITIAL')

// interface FormState {
//   latitude: string
//   longitude: string
// }

const formState = reactive({
  latitude,
  longitude,
})

const handleFinish = () => {
  console.log(`handleFinish - formState: `, formState)
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
      <a-form :model="formState" class="flex flex-col w-full" @finish="handleFinish">
        <a-form-item label="Latitude">
          <a-input v-model:value="formState.latitude" type="number" step="0.000001" :max="90" :min="-90" />
        </a-form-item>
        <a-form-item label="Longitude">
          <a-input v-model:value="formState.longitude" type="number" step="0.000001" :min="-180" :max="180" />
        </a-form-item>
        <a-form-item>
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
input {
  max-width: 150px;
}
.heja {
  background-color: red;
  padding-top: 2rem;
}
</style>
