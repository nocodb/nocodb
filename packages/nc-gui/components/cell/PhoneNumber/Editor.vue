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
const isFocused = ref(false)

const vModel = computed({
  get: () => props.modelValue,
  set: (val) => {
    localState.value = val
    if (!parseProp(column.value.meta)?.validate || (val && isMobilePhone(val)) || !val || isForm.value || isEditColumn.value) {
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
  if (parseProp(column.value.meta)?.validate && localState.value && !isMobilePhone(localState.value.toString())) {
    if (!isEditColumn.value) {
      message.error(t('msg.invalidPhoneNumber'))
    }

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

const onBlur = () => {
  editEnabled.value = false
  isFocused.value = false
}

const validPhoneNumber = computed(() => vModel.value && isMobilePhone(vModel.value.toString()))

const showClicableLink = computed(() => {
  return (isExpandedFormOpen.value || isForm.value) && !isFocused.value && validPhoneNumber.value
})
</script>

<template>
  <!-- eslint-disable vue/use-v-on-exact -->
  <input
    v-bind="$attrs"
    :ref="focus"
    v-model="vModel"
    class="nc-cell-field w-full outline-none py-1"
    :class="{
      'nc-text-transparent': showClicableLink,
    }"
    :disabled="readOnly"
    @blur="onBlur"
    @focus="isFocused = true"
    @keydown.down.stop
    @keydown.left.stop
    @keydown.right.stop
    @keydown.up.stop
    @keydown.delete.stop
    @keydown.alt.stop
    @selectstart.capture.stop
    @mousedown.stop
  />
  <div
    v-if="showClicableLink"
    class="nc-cell-field nc-cell-link-preview absolute inset-0 flex items-center max-w-full overflow-hidden pointer-events-none"
  >
    <a
      no-ref
      class="truncate text-primary cursor-pointer pointer-events-auto no-user-select tracking-tighter"
      :href="`tel:${vModel}`"
      target="_blank"
      rel="noopener noreferrer"
      :tabindex="-1"
    >
      {{ vModel }}
    </a>
  </div>
</template>
