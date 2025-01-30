<script lang="ts" setup>
import type { VNodeRef } from '@vue/runtime-core'
import isMobilePhone from 'validator/lib/isMobilePhone'

interface Props {
  modelValue: string | null | number | undefined
}

const { modelValue: value } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()

const editEnabled = inject(EditModeInj, ref(false))

const isEditColumn = inject(EditColumnInj, ref(false))

const readOnly = inject(ReadonlyInj, ref(false))

const column = inject(ColumnInj)!

const isForm = inject(IsFormInj)!

// Used in the logic of when to display error since we are not storing the phone if it's not valid
const localState = ref(value)

const vModel = computed({
  get: () => value,
  set: (val) => {
    localState.value = val
    if (!parseProp(column.value.meta)?.validate || (val && isMobilePhone(val)) || !val || isForm.value) {
      emit('update:modelValue', val)
    }
  },
})

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))!

const focus: VNodeRef = (el) =>
  !isExpandedFormOpen.value && !isEditColumn.value && !isForm.value && (el as HTMLInputElement)?.focus()

onBeforeUnmount(() => {
  if (parseProp(column.value.meta)?.validate && !editEnabled.value && localState.value && !isMobilePhone(localState.value)) {
    message.error(t('msg.invalidPhoneNumber'))
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
  />
</template>
