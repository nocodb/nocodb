<script lang="ts" setup>
import type { VNodeRef } from '@vue/runtime-core'
import isMobilePhone from 'validator/lib/isMobilePhone'

interface Props {
  modelValue: string | null | number | undefined
}

const props = defineProps<Props>()
const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()
const editEnabled = inject(EditModeInj, ref(false))
const isEditColumn = inject(EditColumnInj, ref(false))
const readOnly = inject(ReadonlyInj, ref(false))
const column = inject(ColumnInj)!
const isForm = inject(IsFormInj)!
const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))!
const isCanvasInjected = inject(IsCanvasInjectionInj, false)

// Used in the logic of when to display error since we are not storing the phone if it's not valid
const localState = ref(props.modelValue)
const inputRef = ref<HTMLInputElement>()

const vModel = computed({
  get: () => props.modelValue,
  set: (val) => {
    localState.value = val
    if (!parseProp(column.value.meta)?.validate || (val && isMobilePhone(val)) || !val || isForm.value) {
      emit('update:modelValue', val)
    }
  },
})

// Modified focus ref function to match reference implementation
const focus: VNodeRef = (el) => {
  if (!isExpandedFormOpen.value && !isEditColumn.value && !isForm.value) {
    inputRef.value = el as HTMLInputElement
    inputRef.value?.focus()
  }
}

onBeforeUnmount(() => {
  if (parseProp(column.value.meta)?.validate && localState.value && !isMobilePhone(localState.value)) {
    message.error(t('msg.invalidPhoneNumber'))
    localState.value = undefined
    return
  }
  localState.value = props.modelValue
})

onMounted(() => {
  if (isCanvasInjected && !isExpandedFormOpen.value && !isEditColumn.value && !isForm.value) {
    inputRef.value?.focus()
  }
})
</script>

<template>
  <!-- eslint-disable vue/use-v-on-exact -->
  <input
    :ref="focus"
    v-model="vModel"
    class="nc-cell-field w-full outline-none py-1"
    :disabled="readOnly"
    @blur="editEnabled = false"
    @keydown.down.stop
    @keydown.left.stop
    @keydown.right.stop
    @keydown.up.stop
    @keydown.delete.stop
    @keydown.alt.stop
    @selectstart.capture.stop
    @mousedown.stop
  />
</template>
