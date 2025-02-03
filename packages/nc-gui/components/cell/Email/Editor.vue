<script lang="ts" setup>
import type { VNodeRef } from '@vue/runtime-core'
import { extractEmail } from '~/helpers/parsers/parserHelpers'

interface Props {
  modelValue: string | null | undefined
}

const { modelValue: value } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()

const editEnabled = inject(EditModeInj, ref(false))

const readOnly = inject(ReadonlyInj, ref(false))

const column = inject(ColumnInj)!

const isEditColumn = inject(EditColumnInj, ref(false))

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))!

const isForm = inject(IsFormInj)!

// Used in the logic of when to display error since we are not storing the email if it's not valid
const localState = ref(value)

const vModel = computed({
  get: () => value,
  set: (val) => {
    localState.value = val
    if (!parseProp(column.value.meta)?.validate || (val && validateEmail(val)) || !val || isForm.value) {
      emit('update:modelValue', val)
    }
  },
})

const focus: VNodeRef = (el) =>
  !isExpandedFormOpen.value && !isEditColumn.value && !isForm.value && (el as HTMLInputElement)?.focus()

const onPaste = (e: ClipboardEvent) => {
  const pastedText = e.clipboardData?.getData('text') ?? ''

  if (parseProp(column.value.meta).validate) {
    vModel.value = extractEmail(pastedText) || pastedText
  } else {
    vModel.value = pastedText
  }
}

onBeforeUnmount(() => {
  if (
    !isForm.value &&
    parseProp(column.value.meta)?.validate &&
    !editEnabled.value &&
    localState.value &&
    !validateEmail(localState.value)
  ) {
    message.error(t('msg.error.invalidEmail'))
    localState.value = undefined
    return
  }
  localState.value = value
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
    @paste.prevent="onPaste"
  />
</template>
