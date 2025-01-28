<script setup lang="ts">
import type { VNodeRef } from '@vue/runtime-core'

interface Props {
  modelValue?: string | null
}

const { modelValue: value } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()

const column = inject(ColumnInj)!

const editEnabled = inject(EditModeInj, ref(false))

const isEditColumn = inject(EditColumnInj, ref(false))

const readOnly = inject(ReadonlyInj, ref(false))

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))!

const isForm = inject(IsFormInj)!

const trim = (val: string) => val?.trim?.()

// Used in the logic of when to display error since we are not storing the url if it's not valid
const localState = ref(value)

const vModel = computed({
  get: () => value,
  set: (val) => {
    localState.value = val
    if (!parseProp(column.value.meta)?.validate || (val && isValidURL(trim(val))) || !val || isForm.value) {
      emit('update:modelValue', val)
    }
  },
})

const focus: VNodeRef = (el) => {
  if (!isExpandedFormOpen.value && !isEditColumn.value && !isForm.value) {
    nextTick(() => {
      ;(el as HTMLInputElement)?.focus()
    })
  }

  return el
}

onBeforeUnmount(() => {
  if (
    !isForm.value &&
    parseProp(column.value.meta)?.validate &&
    !editEnabled.value &&
    localState.value &&
    !isValidURL(trim(localState.value))
  ) {
    message.error(t('msg.error.invalidURL'))
    localState.value = undefined
    return
  }
  localState.value = value
})
</script>

<template>
  <div class="flex flex-row items-center justify-between w-full h-full">
    <!-- eslint-disable vue/use-v-on-exact -->
    <input
      :ref="focus"
      v-model="vModel"
      class="nc-cell-field outline-none w-full py-1 bg-transparent h-full"
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
  </div>
</template>
